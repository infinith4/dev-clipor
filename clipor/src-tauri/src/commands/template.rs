use tauri::{AppHandle, Manager, State};

use crate::models::template::{TemplateEntry, TemplateExportPayload, TemplateGroup};
use crate::services::template_store::UpsertTemplateInput;
use crate::AppState;

#[tauri::command]
pub fn get_template_groups(state: State<'_, AppState>) -> Result<Vec<TemplateGroup>, String> {
    state.template_store.list_groups()
}

#[tauri::command]
pub fn get_templates(
    state: State<'_, AppState>,
    search: Option<String>,
    group_id: Option<i64>,
) -> Result<Vec<TemplateEntry>, String> {
    state
        .template_store
        .list_templates(search.as_deref(), group_id)
}

#[tauri::command]
pub fn upsert_template(
    state: State<'_, AppState>,
    id: Option<i64>,
    title: String,
    text: String,
    group_id: Option<i64>,
    new_group_name: Option<String>,
) -> Result<(), String> {
    state.template_store.upsert_template(UpsertTemplateInput {
        id,
        title,
        text,
        group_id,
        new_group_name,
    })
}

#[tauri::command]
pub fn delete_template(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.template_store.delete_template(id)
}

#[tauri::command]
pub fn paste_template(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let template = state
        .template_store
        .get_template(id)?
        .ok_or_else(|| "定型文が見つかりません。".to_string())?;
    let clipboard_text = state.paste_service.get_clipboard_text()?;
    let rendered = state
        .template_store
        .render_placeholders(&template.text, &clipboard_text);

    // ウィンドウを隠してフォーカスを元のアプリに戻してからペースト
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(100));

    state
        .paste_service
        .paste_text(&rendered, state.clipboard_guard.clone())
}

#[tauri::command]
pub fn export_templates(state: State<'_, AppState>) -> Result<TemplateExportPayload, String> {
    state.template_store.export_templates()
}

#[tauri::command]
pub fn import_templates(state: State<'_, AppState>, json: String) -> Result<(), String> {
    state.template_store.import_templates(&json)
}
