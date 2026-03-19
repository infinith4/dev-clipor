use std::fs;
use std::path::PathBuf;

use crate::models::app_settings::AppSettings;
use crate::native::win32;
use crate::services::hotkey_detector::normalize_hotkey;

#[derive(Debug, Clone)]
pub struct SettingsService {
    path: PathBuf,
}

impl SettingsService {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Result<AppSettings, String> {
        if !self.path.exists() {
            return Ok(AppSettings::default());
        }

        let json = fs::read_to_string(&self.path).map_err(|error| error.to_string())?;
        serde_json::from_str(&json).map_err(|error| error.to_string())
    }

    pub fn save(&self, settings: &AppSettings) -> Result<AppSettings, String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let mut normalized = settings.clone();
        normalized.hotkey = normalize_hotkey(&normalized.hotkey)?;

        if let Ok(executable) = std::env::current_exe() {
            win32::set_launch_on_startup(
                "Clipor",
                &executable,
                normalized.launch_on_startup,
            )?;
        }

        let json = serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?;
        fs::write(&self.path, json).map_err(|error| error.to_string())?;
        Ok(normalized)
    }
}
