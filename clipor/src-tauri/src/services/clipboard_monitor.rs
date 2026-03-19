use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::native::win32;
use crate::services::clipboard_history_store::ClipboardHistoryStore;
use crate::services::settings_service::SettingsService;

pub fn spawn_monitor(
    history_store: ClipboardHistoryStore,
    settings_service: SettingsService,
    clipboard_guard: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let mut last_seen = String::new();

        loop {
            if clipboard_guard.swap(false, Ordering::SeqCst) {
                if let Ok(Some(text)) = win32::get_clipboard_text() {
                    last_seen = text;
                }
                thread::sleep(Duration::from_millis(250));
                continue;
            }

            match win32::get_clipboard_text() {
                Ok(Some(text)) if !text.trim().is_empty() && text != last_seen => {
                    let settings = settings_service.load().unwrap_or_default();
                    let _ = history_store.save_text(&text, None, settings.max_history_items);
                    last_seen = text;
                }
                Ok(Some(text)) => {
                    last_seen = text;
                }
                Ok(None) => {}
                Err(_) => {}
            }

            thread::sleep(Duration::from_millis(400));
        }
    });
}
