use serde::{Deserialize, Serialize};

fn default_hotkey() -> String {
    "Ctrl+Alt+Z".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub max_history_items: usize,
    pub page_size: usize,
    #[serde(default = "default_hotkey")]
    pub hotkey: String,
    pub launch_on_startup: bool,
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
            launch_on_startup: false,
            require_password: false,
            password_salt: None,
            password_verify: None,
        }
    }
}
