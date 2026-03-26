use serde::{Deserialize, Serialize};

fn default_hotkey() -> String {
    "Ctrl+Alt+Z".to_string()
}

fn default_activation_mode() -> String {
    "hotkey".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub max_history_items: usize,
    pub page_size: usize,
    #[serde(default = "default_hotkey")]
    pub hotkey: String,
    #[serde(default = "default_activation_mode")]
    pub activation_mode: String,
    pub launch_on_startup: bool,
    pub blur_delay_ms: u64,
    pub preview_width: u32,
    pub preview_height: u32,
    pub preview_image_width: u32,
    pub preview_image_height: u32,
    pub require_password: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_salt: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_verify: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            max_history_items: 1000,
            page_size: 20,
            hotkey: default_hotkey(),
            activation_mode: default_activation_mode(),
            launch_on_startup: false,
            blur_delay_ms: 100,
            preview_width: 320,
            preview_height: 400,
            preview_image_width: 520,
            preview_image_height: 520,
            require_password: false,
            password_salt: None,
            password_verify: None,
        }
    }
}
