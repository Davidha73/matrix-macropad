use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActionPayload {
    pub r#type: Option<String>,
    pub value: Option<String>,
    pub key: Option<String>,
    pub modifiers: Option<Vec<String>>,
    pub command: Option<String>,
}

fn map_key_string(k: &str) -> Option<Key> {
    let lower = k.to_lowercase();
    match lower.as_str() {
        "enter" | "return" => Some(Key::Return),
        "backspace" => Some(Key::Backspace),
        "tab" => Some(Key::Tab),
        "space" => Some(Key::Space),
        "escape" | "esc" => Some(Key::Escape),
        "delete" => Some(Key::Delete),
        "home" => Some(Key::Home),
        "end" => Some(Key::End),
        "pageup" => Some(Key::PageUp),
        "pagedown" => Some(Key::PageDown),
        "up" => Some(Key::UpArrow),
        "down" => Some(Key::DownArrow),
        "left" => Some(Key::LeftArrow),
        "right" => Some(Key::RightArrow),
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),
        _ => {
            if let Some(c) = k.chars().next() {
                Some(Key::Unicode(c))
            } else {
                None
            }
        }
    }
}

pub fn execute_macro_action(action: ActionPayload) {
    let action_type = action.r#type.unwrap_or_default();

    match action_type.as_str() {
        "text" => {
            if let Some(text) = action.value {
                if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
                    let _ = enigo.text(&text);
                }
            }
        }
        "hotkey" | "shortcut" => {
            if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
                let mut pressed_modifiers = Vec::new();

                if let Some(mods) = action.modifiers {
                    for m in mods {
                        let mod_key = match m.to_lowercase().as_str() {
                            "control" | "ctrl" => Some(Key::Control),
                            "shift" => Some(Key::Shift),
                            "alt" => Some(Key::Alt),
                            "command" | "cmd" | "meta" | "win" => Some(Key::Meta),
                            _ => None,
                        };
                        if let Some(k) = mod_key {
                            let _ = enigo.key(k, Press);
                            pressed_modifiers.push(k);
                        }
                    }
                }

                if let Some(key_str) = action.key.or(action.value) {
                    if let Some(k) = map_key_string(&key_str) {
                        let _ = enigo.key(k, Click);
                    }
                }

                for k in pressed_modifiers.into_iter().rev() {
                    let _ = enigo.key(k, Release);
                }
            }
        }
        "command" | "app" => {
            if let Some(cmd) = action.command.or(action.value) {
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("cmd").args(["/C", "start", "", &cmd]).spawn();
                }
                #[cfg(target_os = "macos")]
                {
                    let _ = Command::new("open").arg(&cmd).spawn();
                }
                #[cfg(target_os = "linux")]
                {
                    let _ = Command::new("xdg-open").arg(&cmd).spawn();
                }
            }
        }
        _ => {}
    }
}
