use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::native::win32;
use crate::services::clipboard_history_store::ClipboardHistoryStore;
use crate::services::image_util;
use crate::services::settings_service::SettingsService;

pub fn spawn_monitor(
    history_store: ClipboardHistoryStore,
    settings_service: SettingsService,
    clipboard_guard: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let mut last_seen = String::new();
        let mut last_image_hash = String::new();

        loop {
            if clipboard_guard.swap(false, Ordering::SeqCst) {
                if let Ok(Some(text)) = win32::get_clipboard_text() {
                    last_seen = text;
                }
                thread::sleep(Duration::from_millis(250));
                continue;
            }

            let settings = settings_service.load().unwrap_or_default();

            // If password is required but key not yet available (locked), skip saving
            if settings.require_password && !history_store.has_encryption_key() {
                thread::sleep(Duration::from_millis(400));
                continue;
            }

            // Check for image first — single clipboard session avoids TOCTOU race
            if let Some(dib_data) = win32::try_get_clipboard_image() {
                if dib_data.len() <= image_util::MAX_IMAGE_BYTES {
                    let hash = image_util::hash_image(&dib_data);
                    if hash != last_image_hash {
                        if let Ok(png) = image_util::dib_to_png(&dib_data) {
                            let b64 = image_util::png_to_base64(&png);
                            let _ = history_store.save_image(
                                &b64,
                                &hash,
                                settings.max_history_items,
                            );
                            last_image_hash = hash;
                            // Also update last_seen so we don't double-save
                            // if the clipboard also has text representation
                            if let Ok(Some(text)) = win32::get_clipboard_text() {
                                last_seen = text;
                            }
                        }
                    }
                }
                thread::sleep(Duration::from_millis(400));
                continue;
            }

            // Text clipboard
            match win32::get_clipboard_text() {
                Ok(Some(text)) if !text.trim().is_empty() && text != last_seen => {
                    let _ = history_store.save_text(&text, None, settings.max_history_items);
                    last_seen = text;
                    last_image_hash.clear();
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
