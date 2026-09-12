// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod macros;
mod serial;

use commands::*;
use serial::SerialManager;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

fn main() {
    // Disable hardware acceleration to resolve external display and GPU rendering issues
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu --disable-gpu-compositing");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            serial: SerialManager::new(),
            toggled_states: Mutex::new(HashMap::new()),
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    let _ = w.show();
                });
            }

            // Continuous background serial hardware monitoring and auto-connection
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_connected = false;
                loop {
                    let state = handle.state::<AppState>();
                    let status = state.serial.auto_connect();
                    if status.connected != last_connected {
                        last_connected = status.connected;
                        let _ = handle.emit("hardware-status", status);
                    }
                    std::thread::sleep(std::time::Duration::from_millis(2500));
                }
            });

            let config_item = MenuItem::with_id(app, "configure", "Configure Macros & Settings ⚙️", true, None::<&str>)?;
            let sync_item = MenuItem::with_id(app, "sync", "Sync Layout to Touchscreen 🔄", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Macropad", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&config_item, &sync_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Matrix Macropad")
                .menu(&menu);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "configure" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "sync" => {
                        let state = app.state::<AppState>();
                        let _ = state.serial.auto_connect();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = window.hide();
                std::process::exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            trigger_macro,
            get_config,
            save_config,
            list_profiles,
            save_profile,
            load_profile,
            export_profile,
            import_profile,
            export_theme_file,
            import_theme_file,
            select_image,
            get_hardware_status,
            sync_hardware,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            toggle_button_state,
            get_app_version,
            show_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
