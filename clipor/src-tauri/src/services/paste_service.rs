use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::native::win32;

#[derive(Debug, Clone, Default)]
pub struct PasteService;

impl PasteService {
    pub fn paste_text(&self, text: &str, clipboard_guard: Arc<AtomicBool>) -> Result<(), String> {
        clipboard_guard.store(true, Ordering::SeqCst);
        win32::set_clipboard_text(text)?;
        win32::send_ctrl_v()
    }

    pub fn paste_image(&self, dib_data: &[u8], clipboard_guard: Arc<AtomicBool>) -> Result<(), String> {
        clipboard_guard.store(true, Ordering::SeqCst);
        win32::set_clipboard_image(dib_data)?;
        win32::send_ctrl_v()
    }

    pub fn get_clipboard_text(&self) -> Result<String, String> {
        win32::get_clipboard_text().map(|value| value.unwrap_or_default())
    }
}
