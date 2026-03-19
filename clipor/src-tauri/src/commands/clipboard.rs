use tauri::{AppHandle, Manager, State};

use crate::models::clipboard_entry::ClipboardHistoryPage;
use crate::AppState;

#[tauri::command]
pub fn get_history(
    state: State<'_, AppState>,
    page: usize,
    page_size: usize,
    search: Option<String>,
) -> Result<ClipboardHistoryPage, String> {
    state
        .history_store
        .list_history(page, page_size, search.as_deref())
}

#[tauri::command]
pub fn paste_history_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let entry = state
        .history_store
        .get_entry(id)?
        .ok_or_else(|| "履歴アイテムが見つかりません。".to_string())?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(100));

    state
        .paste_service
        .paste_text(&entry.text, state.clipboard_guard.clone())
}

#[tauri::command]
pub fn update_history_entry(
    state: State<'_, AppState>,
    id: i64,
    text: String,
) -> Result<(), String> {
    state.history_store.update_entry_text(id, &text)
}

#[tauri::command]
pub fn set_history_pinned(
    state: State<'_, AppState>,
    id: i64,
    pinned: bool,
) -> Result<(), String> {
    state.history_store.set_pinned(id, pinned)
}

#[tauri::command]
pub fn delete_history_entry(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.history_store.delete_entry(id)
}

/// クリップボードにセット（整形）: 前後空白除去、連続空行を1つに、行末空白除去
#[tauri::command]
pub fn set_clipboard_formatted(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let entry = state
        .history_store
        .get_entry(id)?
        .ok_or_else(|| "履歴アイテムが見つかりません。".to_string())?;

    let formatted = format_text(&entry.text);
    state.clipboard_guard.store(true, std::sync::atomic::Ordering::SeqCst);
    crate::native::win32::set_clipboard_text(&formatted)
}

/// クリップボードにセット（変換）: 全角英数→半角、半角カナ→全角カナ
#[tauri::command]
pub fn set_clipboard_converted(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let entry = state
        .history_store
        .get_entry(id)?
        .ok_or_else(|| "履歴アイテムが見つかりません。".to_string())?;

    let converted = convert_text(&entry.text);
    state.clipboard_guard.store(true, std::sync::atomic::Ordering::SeqCst);
    crate::native::win32::set_clipboard_text(&converted)
}

fn format_text(text: &str) -> String {
    let trimmed = text.trim();
    let lines: Vec<&str> = trimmed.lines().map(|line| line.trim()).collect();

    let mut result = Vec::new();
    let mut prev_empty = false;
    for line in lines {
        if line.is_empty() {
            if !prev_empty {
                result.push("");
            }
            prev_empty = true;
        } else {
            result.push(line);
            prev_empty = false;
        }
    }

    result.join("\r\n")
}

fn convert_text(text: &str) -> String {
    text.chars().map(convert_char).collect()
}

fn convert_char(c: char) -> char {
    match c {
        // 全角英数字・記号 → 半角
        '\u{FF01}'..='\u{FF5E}' => char::from_u32(c as u32 - 0xFF01 + 0x21).unwrap_or(c),
        // 全角スペース → 半角
        '\u{3000}' => ' ',
        _ => c,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_trims_and_collapses() {
        let input = "  hello  \n\n\n  world  \n";
        let result = format_text(input);
        assert_eq!(result, "hello\r\n\r\nworld");
    }

    #[test]
    fn convert_fullwidth_to_halfwidth() {
        assert_eq!(convert_text("Ｈｅｌｌｏ　１２３"), "Hello 123");
    }
}
