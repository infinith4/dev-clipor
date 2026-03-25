use tauri::{AppHandle, Manager, State};

/// ウィンドウを閉じてCtrl+Vで貼り付ける共通処理
fn hide_and_paste(app: &AppHandle, state: &State<'_, AppState>, text: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(100));

    state.clipboard_guard.store(true, std::sync::atomic::Ordering::SeqCst);
    crate::native::win32::set_clipboard_text(text)?;
    crate::native::win32::send_ctrl_v()
}

use crate::models::clipboard_entry::ClipboardHistoryPage;
use crate::AppState;

#[tauri::command(rename_all = "camelCase")]
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

    if entry.content_type == "image" {
        if let Some(ref b64) = entry.image_data {
            use base64::Engine;
            let png_bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 decode error: {e}"))?;
            let dib_data = crate::services::image_util::png_to_dib(&png_bytes)?;
            return state
                .paste_service
                .paste_image(&dib_data, state.clipboard_guard.clone());
        }
        // Fallback if no image_data
        state
            .paste_service
            .paste_text(&entry.text, state.clipboard_guard.clone())
    } else {
        state
            .paste_service
            .paste_text(&entry.text, state.clipboard_guard.clone())
    }
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
pub fn set_clipboard_formatted(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let entry = state
        .history_store
        .get_entry(id)?
        .ok_or_else(|| "履歴アイテムが見つかりません。".to_string())?;

    let formatted = format_text(&entry.text);
    hide_and_paste(&app, &state, &formatted)
}

/// クリップボードにセット（変換）: 全角英数→半角、半角カナ→全角カナ
#[tauri::command]
pub fn set_clipboard_converted(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let entry = state
        .history_store
        .get_entry(id)?
        .ok_or_else(|| "履歴アイテムが見つかりません。".to_string())?;

    let converted = convert_text(&entry.text);
    hide_and_paste(&app, &state, &converted)
}

/// クリップボードにテキストを整形してセット（テキスト直接指定）
#[tauri::command]
pub fn set_clipboard_text_formatted(app: AppHandle, state: State<'_, AppState>, text: String) -> Result<(), String> {
    let formatted = format_text(&text);
    hide_and_paste(&app, &state, &formatted)
}

/// クリップボードにテキストを変換してセット（テキスト直接指定）
#[tauri::command]
pub fn set_clipboard_text_converted(app: AppHandle, state: State<'_, AppState>, text: String) -> Result<(), String> {
    let converted = convert_text(&text);
    hide_and_paste(&app, &state, &converted)
}

/// テキスト変換してクリップボードにセット＆貼り付け（汎用）
#[tauri::command(rename_all = "camelCase")]
pub fn transform_and_paste(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
    transform_type: String,
) -> Result<(), String> {
    let result = apply_transform(&text, &transform_type)?;
    hide_and_paste(&app, &state, &result)
}

fn apply_transform(text: &str, transform_type: &str) -> Result<String, String> {
    match transform_type {
        // 整形系
        "trim" => Ok(text.trim().to_string()),
        "remove_empty_lines" => Ok(remove_empty_lines(text)),
        "collapse_blank_lines" => Ok(format_text(text)),
        "trim_trailing" => Ok(trim_trailing_whitespace(text)),
        "remove_duplicate_lines" => Ok(remove_duplicate_lines(text)),
        "remove_html_tags" => Ok(remove_html_tags(text)),
        "add_comment_prefix" => Ok(add_comment_prefix(text)),
        "add_quote_prefix" => Ok(add_quote_prefix(text)),
        "add_numbering" => Ok(add_numbering(text)),
        "wrap_lines_in_quotes" => Ok(wrap_lines_in_quotes(text)),
        // 変換系
        "fullwidth_to_halfwidth" => Ok(convert_text(text)),
        "halfwidth_to_fullwidth" => Ok(convert_halfwidth_to_fullwidth(text)),
        "to_uppercase" => Ok(text.to_uppercase()),
        "to_lowercase" => Ok(text.to_lowercase()),
        _ => Err(format!("不明な変換タイプ: {}", transform_type)),
    }
}

fn remove_empty_lines(text: &str) -> String {
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn trim_trailing_whitespace(text: &str) -> String {
    text.lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn remove_duplicate_lines(text: &str) -> String {
    let mut seen = std::collections::HashSet::new();
    text.lines()
        .filter(|line| seen.insert(line.to_string()))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn remove_html_tags(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_tag = false;
    for c in text.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result
}

fn add_comment_prefix(text: &str) -> String {
    text.lines()
        .map(|line| format!("// {}", line))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn add_quote_prefix(text: &str) -> String {
    text.lines()
        .map(|line| format!("> {}", line))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn add_numbering(text: &str) -> String {
    text.lines()
        .enumerate()
        .map(|(i, line)| format!("{}. {}", i + 1, line))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn wrap_lines_in_quotes(text: &str) -> String {
    text.lines()
        .map(|line| format!("\"{}\"", line))
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn convert_halfwidth_to_fullwidth(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '!'..='~' => char::from_u32(c as u32 - 0x21 + 0xFF01).unwrap_or(c),
            ' ' => '\u{3000}',
            _ => c,
        })
        .collect()
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

    #[test]
    fn convert_halfwidth_to_fullwidth_basic() {
        assert_eq!(convert_halfwidth_to_fullwidth("Hello 123"), "Ｈｅｌｌｏ\u{3000}１２３");
    }

    #[test]
    fn remove_empty_lines_basic() {
        assert_eq!(remove_empty_lines("a\n\nb\n\n\nc"), "a\r\nb\r\nc");
    }

    #[test]
    fn trim_trailing_whitespace_basic() {
        assert_eq!(trim_trailing_whitespace("hello  \nworld  "), "hello\r\nworld");
    }

    #[test]
    fn remove_duplicate_lines_basic() {
        assert_eq!(remove_duplicate_lines("a\nb\na\nc\nb"), "a\r\nb\r\nc");
    }

    #[test]
    fn remove_html_tags_basic() {
        assert_eq!(remove_html_tags("<p>hello</p>"), "hello");
        assert_eq!(remove_html_tags("no tags"), "no tags");
    }

    #[test]
    fn add_comment_prefix_basic() {
        assert_eq!(add_comment_prefix("hello\nworld"), "// hello\r\n// world");
    }

    #[test]
    fn add_quote_prefix_basic() {
        assert_eq!(add_quote_prefix("hello\nworld"), "> hello\r\n> world");
    }

    #[test]
    fn add_numbering_basic() {
        assert_eq!(add_numbering("a\nb\nc"), "1. a\r\n2. b\r\n3. c");
    }

    #[test]
    fn wrap_lines_in_quotes_basic() {
        assert_eq!(wrap_lines_in_quotes("hello\nworld"), "\"hello\"\r\n\"world\"");
    }

    #[test]
    fn apply_transform_unknown_type() {
        assert!(apply_transform("text", "unknown").is_err());
    }

    #[test]
    fn apply_transform_trim() {
        assert_eq!(apply_transform("  hello  ", "trim").unwrap(), "hello");
    }

    #[test]
    fn apply_transform_to_uppercase() {
        assert_eq!(apply_transform("hello", "to_uppercase").unwrap(), "HELLO");
    }

    #[test]
    fn apply_transform_to_lowercase() {
        assert_eq!(apply_transform("HELLO", "to_lowercase").unwrap(), "hello");
    }
}
