use serde::{Deserialize, Serialize};
use serialport::{available_ports, SerialPort, SerialPortType};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HardwareStatus {
    pub connected: bool,
    pub port: Option<String>,
}

#[derive(Clone)]
pub struct SerialManager {
    port: Arc<Mutex<Option<Box<dyn SerialPort>>>>,
    active_port_name: Arc<Mutex<Option<String>>>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            port: Arc::new(Mutex::new(None)),
            active_port_name: Arc::new(Mutex::new(None)),
        }
    }

    pub fn auto_connect(&self) -> HardwareStatus {
        {
            let p_lock = self.port.lock().unwrap();
            let name_lock = self.active_port_name.lock().unwrap();
            if p_lock.is_some() {
                return HardwareStatus {
                    connected: true,
                    port: name_lock.clone(),
                };
            }
        }

        if let Ok(ports) = available_ports() {
            let mut candidate = None;
            for p in &ports {
                if let SerialPortType::UsbPort(ref info) = p.port_type {
                    let desc = info.product.clone().unwrap_or_default().to_lowercase();
                    let mfg = info.manufacturer.clone().unwrap_or_default().to_lowercase();
                    if info.vid == 0x303a || info.vid == 0x1a86 || info.vid == 0x10c4 || info.vid == 0x0403
                        || desc.contains("esp") || desc.contains("usb") || desc.contains("serial")
                        || mfg.contains("espressif") {
                        candidate = Some(p.port_name.clone());
                        break;
                    }
                }
            }

            if candidate.is_none() {
                if ports.len() == 1 {
                    candidate = Some(ports[0].port_name.clone());
                } else {
                    for p in &ports {
                        if p.port_name.to_uppercase() == "COM5" || p.port_name.contains("usbmodem") {
                            candidate = Some(p.port_name.clone());
                            break;
                        }
                    }
                }
            }

            if let Some(port_name) = candidate {
                if let Ok(port) = serialport::new(&port_name, 115_200)
                    .timeout(Duration::from_millis(500))
                    .open()
                {
                    let mut p_lock = self.port.lock().unwrap();
                    let mut name_lock = self.active_port_name.lock().unwrap();
                    *p_lock = Some(port);
                    *name_lock = Some(port_name.clone());

                    return HardwareStatus {
                        connected: true,
                        port: Some(port_name),
                    };
                }
            }
        }

        HardwareStatus {
            connected: false,
            port: None,
        }
    }

    pub fn get_status(&self) -> HardwareStatus {
        let p_lock = self.port.lock().unwrap();
        let name_lock = self.active_port_name.lock().unwrap();
        HardwareStatus {
            connected: p_lock.is_some(),
            port: name_lock.clone(),
        }
    }

    pub fn send_bytes(&self, data: &[u8]) -> bool {
        let mut p_lock = self.port.lock().unwrap();
        if let Some(ref mut port) = *p_lock {
            port.write_all(data).is_ok()
        } else {
            false
        }
    }

    pub fn sync_config(&self, config: &serde_json::Value) -> bool {
        let mut p_lock = self.port.lock().unwrap();
        if let Some(ref mut port) = *p_lock {
            let active_theme = config.get("_theme").and_then(|v| v.as_str()).unwrap_or("default");
            let mut total_pages = 3;
            for p in 1..=8 {
                let key = format!("p{}-name", p);
                if config.get(&key).is_some() {
                    total_pages = p;
                }
            }

            for p in 1..=total_pages {
                let title_key = format!("p{}-name", p);
                let title = config.get(&title_key)
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                let mut buttons = Vec::new();
                for b in 1..=6 {
                    let btn_key = format!("p{}-b{}", p, b);
                    let item = config.get(&btn_key).cloned().unwrap_or(serde_json::json!({}));
                    
                    let raw_label = item.get("label")
                        .or_else(|| config.get(&format!("{}-label", btn_key)))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    let shortcut = item.get("value")
                        .or_else(|| item.get("shortcut"))
                        .or_else(|| config.get(&format!("{}-value", btn_key)))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let action = item.get("type").and_then(|v| v.as_str()).unwrap_or("shortcut").to_string();
                    let explicit_icon = item.get("materialIcon").or_else(|| item.get("icon")).and_then(|v| v.as_str()).unwrap_or("");

                    let (clean_label, icon) = clean_label_and_icon(raw_label, explicit_icon, b);
                    let (bg, bg2, text_color) = resolve_color(&item, active_theme);
                    let font_size = resolve_font_size(item.get("fontSize"));
                    let radius = resolve_radius(item.get("borderRadius").or_else(|| item.get("radius")));
                    let border_width = item.get("borderWidth").and_then(|v| v.as_i64()).unwrap_or(0);
                    let border_color = item.get("borderColor").and_then(|v| v.as_str()).unwrap_or("#ffffff");
                    let border_style = item.get("borderStyle").and_then(|v| v.as_str()).unwrap_or(if border_width > 0 { "solid" } else { "none" });

                    let icon_color = item.get("customIconColor")
                        .and_then(|v| v.as_str())
                        .filter(|s| *s != "same_as_text" && s.starts_with('#'))
                        .unwrap_or(&text_color);

                    buttons.push(serde_json::json!({
                        "label": clean_label,
                        "shortcut": shortcut,
                        "action": action.clone(),
                        "type": action,
                        "duration": 0,
                        "bg": bg,
                        "bg2": bg2,
                        "textColor": text_color,
                        "iconColor": icon_color,
                        "borderColor": border_color,
                        "borderWidth": border_width,
                        "borderStyle": border_style,
                        "radius": radius,
                        "fontSize": font_size,
                        "icon": icon,
                        "iconFit": item.get("iconFit").and_then(|v| v.as_str()).unwrap_or("contain"),
                        "sub_buttons": item.get("sub_buttons").cloned().unwrap_or(serde_json::json!([]))
                    }));
                }

                let sync_cmd = serde_json::json!({
                    "cmd": "sync_page",
                    "page": p,
                    "totalPages": total_pages,
                    "title": title,
                    "buttons": buttons,
                    "silent": false
                });

                if let Ok(line) = serde_json::to_string(&sync_cmd) {
                    let _ = port.write_all(format!("{}\n", line).as_bytes());
                    let _ = port.flush();
                    std::thread::sleep(std::time::Duration::from_millis(60));
                }
            }

            let brightness = config.get("_brightness").and_then(|v| v.as_i64()).unwrap_or(50);
            let volume = config.get("_volume").and_then(|v| v.as_i64()).unwrap_or(80);
            let ss_timeout = config.get("_screensaverTimeout").and_then(|v| v.as_i64()).unwrap_or(300);
            let ss_anim = config.get("_screensaverAnim").and_then(|v| v.as_str()).unwrap_or("bouncing_clock");
            let epoch = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            let _ = port.write_all(format!("{}\n", serde_json::json!({ "cmd": "set_brightness", "brightness": brightness })).as_bytes());
            let _ = port.write_all(format!("{}\n", serde_json::json!({ "cmd": "set_volume", "volume": volume })).as_bytes());
            let _ = port.write_all(format!("{}\n", serde_json::json!({ "cmd": "set_screensaver", "timeout": ss_timeout, "anim": ss_anim })).as_bytes());
            let _ = port.write_all(format!("{}\n", serde_json::json!({ "cmd": "sync_time", "epoch": epoch })).as_bytes());

            let save_cmd = serde_json::json!({
                "cmd": "save_profile",
                "name": "layout.json",
                "data": config
            });
            if let Ok(line) = serde_json::to_string(&save_cmd) {
                let _ = port.write_all(format!("{}\n", line).as_bytes());
                let _ = port.flush();
            }

            true
        } else {
            false
        }
    }
}

fn resolve_font_size(val: Option<&serde_json::Value>) -> i64 {
    match val {
        Some(serde_json::Value::Number(n)) => {
            let size = n.as_i64().unwrap_or(68);
            if size > 0 { size } else { 68 }
        }
        Some(serde_json::Value::String(s)) => {
            if s == "default" {
                68
            } else {
                s.parse::<i64>().unwrap_or(68)
            }
        }
        _ => 68,
    }
}

fn resolve_radius(val: Option<&serde_json::Value>) -> i64 {
    match val {
        Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(24),
        Some(serde_json::Value::String(s)) => {
            if s == "default" { 24 } else { s.parse::<i64>().unwrap_or(24) }
        }
        _ => 24,
    }
}

fn clean_label_and_icon(raw_label: &str, explicit_icon: &str, default_index: usize) -> (String, String) {
    let mut icon = explicit_icon.to_string();
    if icon.is_empty() {
        if let Some(start) = raw_label.find('[') {
            if let Some(end) = raw_label[start..].find(']') {
                let icon_candidate = &raw_label[start + 1..start + end];
                if !icon_candidate.is_empty() && icon_candidate.chars().all(|c| c.is_alphanumeric() || c == '_') {
                    icon = icon_candidate.to_string();
                }
            }
        }
    }

    let without_bracket = if let Some(start) = raw_label.find('[') {
        if let Some(end) = raw_label[start..].find(']') {
            let mut s = raw_label.to_string();
            s.replace_range(start..=start + end, "");
            s
        } else {
            raw_label.to_string()
        }
    } else {
        raw_label.to_string()
    };

    let mut cleaned: String = without_bracket.chars().filter(|c| c.is_ascii() && *c >= ' ' && *c <= '~').collect();
    cleaned = cleaned.trim().to_string();

    if cleaned.is_empty() && icon.is_empty() {
        cleaned = format!("Button {}", default_index);
    }

    (cleaned, icon)
}

fn resolve_color(item: &serde_json::Value, active_theme: &str) -> (String, String, String) {
    let color_key = item.get("color").and_then(|v| v.as_str()).unwrap_or("c-gray");
    let custom_text = item.get("customTextColor").or_else(|| item.get("textColor")).and_then(|v| v.as_str());

    if color_key == "transparent" || color_key == "c-transparent" {
        return ("transparent".to_string(), "".to_string(), custom_text.unwrap_or("#ffffff").to_string());
    }

    if color_key == "custom" || color_key == "c-custom" || color_key.starts_with('#') {
        let bg1 = item.get("customColor1").and_then(|v| v.as_str()).unwrap_or(if color_key.starts_with('#') { color_key } else { "#4b5563" });
        let bg2 = item.get("customColor2").and_then(|v| v.as_str()).unwrap_or("");
        let text = custom_text.unwrap_or("#ffffff");
        return (bg1.to_string(), bg2.to_string(), text.to_string());
    }

    let (bg, bg2, text) = match active_theme.to_lowercase().as_str() {
        "cyberpunk" => match color_key {
            "c-edit" => ("#00f0ff", "#0077fe", "#000000"),
            "c-danger" => ("#ff003c", "#990024", "#ffffff"),
            "c-system" => ("#05ffa1", "#00b86b", "#000000"),
            "c-util" => ("#ff007f", "#9b00e8", "#ffffff"),
            "c-nav" => ("#ffe600", "#ff5e00", "#000000"),
            "c-black" => ("#08050e", "", "#05ffa1"),
            "c-white" => ("#e0f7fa", "", "#0b0813"),
            _ => ("#241c38", "#130e20", "#00f0ff"),
        },
        "synthwave" => match color_key {
            "c-edit" => ("#01cdfe", "#0575e6", "#ffffff"),
            "c-danger" => ("#ff2a6d", "#990024", "#ffffff"),
            "c-system" => ("#05ffa1", "#00b4d8", "#000000"),
            "c-util" => ("#ff71ce", "#b900b4", "#ffffff"),
            "c-nav" => ("#f9d423", "#ff4e50", "#000000"),
            "c-black" => ("#0f051d", "", "#01cdfe"),
            "c-white" => ("#f8f8f2", "", "#1a0826"),
            _ => ("#241734", "#12071f", "#ff71ce"),
        },
        "simple" => match color_key {
            "c-white" => ("#ffffff", "", "#000000"),
            _ => ("#000000", "", "#ffffff"),
        },
        "matrix" => match color_key {
            "c-edit" => ("#00ff66", "#009944", "#000000"),
            "c-danger" => ("#ff3333", "#990000", "#ffffff"),
            "c-system" => ("#00cc55", "#003311", "#000000"),
            "c-util" => ("#009944", "#003311", "#ffffff"),
            "c-nav" => ("#aaff00", "#009944", "#000000"),
            "c-black" => ("#051105", "", "#00ff66"),
            "c-white" => ("#d4ffd4", "", "#051105"),
            _ => ("#003311", "#051105", "#00ff66"),
        },
        _ => match color_key {
            "c-edit" => ("#2980b9", "#2573a7", "#ffffff"),
            "c-danger" => ("#c0392b", "#a62c1f", "#ffffff"),
            "c-system" => ("#27ae60", "#219653", "#ffffff"),
            "c-util" => ("#8e44ad", "#7d3c98", "#ffffff"),
            "c-nav" => ("#f39c12", "#d35400", "#ffffff"),
            "c-black" => ("#181a1f", "#0d0f12", "#ffffff"),
            "c-white" => ("#ffffff", "#e2e8f0", "#0f172a"),
            _ => ("#4b5563", "#374151", "#ffffff"),
        },
    };

    let text_final = custom_text.unwrap_or(text);
    (bg.to_string(), bg2.to_string(), text_final.to_string())
}
