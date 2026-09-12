use crate::macros::{execute_macro_action, ActionPayload};
use crate::serial::{HardwareStatus, SerialManager};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

pub struct AppState {
    pub serial: SerialManager,
    pub toggled_states: Mutex<std::collections::HashMap<String, bool>>,
}

fn get_config_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| dirs::data_dir().unwrap_or_default().join("matrix-macropad"))
}

fn write_config_file(app: &AppHandle, config: &Value) -> bool {
    let dir = get_config_dir(app);
    let _ = fs::create_dir_all(&dir);
    let cfg_path = dir.join("config.json");
    if let Ok(content) = serde_json::to_string_pretty(config) {
        fs::write(cfg_path, content).is_ok()
    } else {
        false
    }
}

#[tauri::command]
pub fn trigger_macro(action: ActionPayload) {
    execute_macro_action(action);
}

#[tauri::command]
pub fn get_config(app: AppHandle) -> Value {
    let cfg_path = get_config_dir(&app).join("config.json");
    if let Ok(content) = fs::read_to_string(&cfg_path) {
        if let Ok(json) = serde_json::from_str::<Value>(&content) {
            if json.as_object().map_or(false, |o| !o.is_empty()) {
                return json;
            }
        }
    }
    if let Some(roaming) = dirs::config_dir() {
        let electron_cfg = roaming.join("matrix-macropad").join("macropad-config.json");
        if let Ok(content) = fs::read_to_string(&electron_cfg) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if json.as_object().map_or(false, |o| !o.is_empty()) {
                    let _ = write_config_file(&app, &json);
                    return json;
                }
            }
        }
    }
    for layout_path in &[PathBuf::from("Layout 1.json"), PathBuf::from("../Layout 1.json")] {
        if let Ok(content) = fs::read_to_string(layout_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                let _ = write_config_file(&app, &json);
                return json;
            }
        }
    }
    serde_json::json!({})
}

#[tauri::command]
pub fn save_config(app: AppHandle, state: State<AppState>, config: Value) -> bool {
    let written = write_config_file(&app, &config);
    state.serial.sync_config(&config);
    written
}

#[tauri::command]
pub fn list_profiles(app: AppHandle) -> Vec<String> {
    let profiles_dir = get_config_dir(&app).join("profiles");
    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(profiles_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    names.push(stem.to_string());
                }
            }
        }
    }
    if names.is_empty() {
        names.push("Default".to_string());
    }
    names
}

#[tauri::command]
pub fn save_profile(app: AppHandle, state: State<AppState>, name: String, config: Value) -> bool {
    let profiles_dir = get_config_dir(&app).join("profiles");
    let _ = fs::create_dir_all(&profiles_dir);
    let file_path = profiles_dir.join(format!("{}.json", name));
    let written = if let Ok(content) = serde_json::to_string_pretty(&config) {
        fs::write(file_path, content).is_ok()
    } else {
        false
    };
    let _ = write_config_file(&app, &config);
    state.serial.sync_config(&config);
    written
}

#[tauri::command]
pub fn load_profile(app: AppHandle, state: State<AppState>, name: String) -> Value {
    let file_path = get_config_dir(&app).join("profiles").join(format!("{}.json", name));
    if let Ok(content) = fs::read_to_string(file_path) {
        if let Ok(json) = serde_json::from_str::<Value>(&content) {
            let _ = write_config_file(&app, &json);
            state.serial.sync_config(&json);
            return json;
        }
    }
    let cfg = get_config(app);
    state.serial.sync_config(&cfg);
    cfg
}

#[tauri::command]
pub async fn export_profile(app: AppHandle, state: State<'_, AppState>, mut config: Value) -> Result<Option<Value>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON Layout Files", &["json"])
        .blocking_save_file();

    if let Some(path) = file_path {
        let p = path.as_path().unwrap_or(&PathBuf::new()).to_path_buf();
        let file_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("Layout 1.json").to_string();
        if let Some(obj) = config.as_object_mut() {
            obj.insert("_layoutName".to_string(), serde_json::Value::String(file_name.clone()));
            obj.insert("_activeFilePath".to_string(), serde_json::Value::String(p.to_string_lossy().to_string()));
        }
        if let Ok(content) = serde_json::to_string_pretty(&config) {
            if fs::write(&p, content).is_ok() {
                let _ = write_config_file(&app, &config);
                state.serial.sync_config(&config);
                return Ok(Some(serde_json::json!({
                    "success": true,
                    "fileName": file_name,
                    "filePath": p.to_string_lossy().to_string()
                })));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn import_profile(app: AppHandle, state: State<'_, AppState>) -> Result<Option<Value>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON Layout Files", &["json"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let p = path.as_path().unwrap_or(&PathBuf::new()).to_path_buf();
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(mut json) = serde_json::from_str::<Value>(&content) {
                let file_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("Layout 1.json").to_string();
                let profile_name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Layout 1").to_string();
                if let Some(obj) = json.as_object_mut() {
                    obj.insert("_layoutName".to_string(), serde_json::Value::String(file_name.clone()));
                    obj.insert("_activeFilePath".to_string(), serde_json::Value::String(p.to_string_lossy().to_string()));
                }
                let _ = write_config_file(&app, &json);
                state.serial.sync_config(&json);
                return Ok(Some(serde_json::json!({
                    "profileName": profile_name,
                    "fileName": file_name,
                    "filePath": p.to_string_lossy().to_string(),
                    "data": json
                })));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn export_theme_file(app: AppHandle, theme_data: Value) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Matrix Theme Files", &["json"])
        .blocking_save_file();

    if let Some(path) = file_path {
        let p = path.as_path().unwrap_or(&PathBuf::new()).to_path_buf();
        if let Ok(content) = serde_json::to_string_pretty(&theme_data) {
            if fs::write(&p, content).is_ok() {
                return Ok(Some(p.to_string_lossy().to_string()));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn import_theme_file(app: AppHandle) -> Result<Option<Value>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Matrix Theme Files", &["json"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let p = path.as_path().unwrap_or(&PathBuf::new()).to_path_buf();
        if let Ok(content) = fs::read_to_string(p) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                return Ok(Some(json));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn select_image(app: AppHandle) -> Result<Option<Value>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "svg", "webp", "gif", "ico"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let p = path.as_path().unwrap_or(&PathBuf::new()).to_path_buf();
        if let Ok(bytes) = fs::read(&p) {
            use base64::engine::general_purpose::STANDARD as BASE64;
            use base64::Engine;
            let b64 = BASE64.encode(&bytes);
            let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("png");
            let mime = if ext == "jpg" { "image/jpeg" } else { "image/png" };
            let data_url = format!("data:{};base64,{}", mime, b64);
            let file_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("image.png");

            return Ok(Some(serde_json::json!({
                "fileName": file_name,
                "dataUrl": data_url,
                "filePath": p.to_string_lossy()
            })));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn get_hardware_status(state: State<AppState>) -> HardwareStatus {
    let current = state.serial.get_status();
    if !current.connected {
        state.serial.auto_connect()
    } else {
        current
    }
}

#[tauri::command]
pub fn sync_hardware(app: AppHandle, state: State<AppState>) -> bool {
    let config = get_config(app);
    state.serial.sync_config(&config)
}

#[tauri::command]
pub fn window_minimize(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn window_maximize(window: WebviewWindow) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) {
    for (_, w) in app.webview_windows() {
        let _ = w.hide();
    }
    std::process::exit(0);
}

#[tauri::command]
pub fn window_is_maximized(window: WebviewWindow) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
pub fn toggle_button_state(state: State<AppState>, key: String) -> bool {
    let mut map = state.toggled_states.lock().unwrap();
    let current = map.entry(key).or_insert(false);
    *current = !*current;
    *current
}

#[tauri::command]
pub fn get_app_version() -> String {
    "1.0.1".to_string()
}

#[tauri::command]
pub fn show_window(window: WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}
