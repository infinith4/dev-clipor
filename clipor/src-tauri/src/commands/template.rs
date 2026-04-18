use tauri::{AppHandle, Manager, State};

use crate::models::template::{TemplateExportPayload, TemplateGroup, TemplatePage};
use crate::services::template_store::UpsertTemplateInput;
use crate::AppState;

#[tauri::command]
pub fn get_template_groups(state: State<'_, AppState>) -> Result<Vec<TemplateGroup>, String> {
    state.template_store.list_groups()
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_templates(
    state: State<'_, AppState>,
    search: Option<String>,
    group_id: Option<i64>,
    page: i64,
    page_size: i64,
) -> Result<TemplatePage, String> {
    let all = state
        .template_store
        .list_templates(search.as_deref(), group_id)?;
    let total = all.len() as i64;
    let offset = ((page - 1).max(0) * page_size) as usize;
    let entries = all.into_iter().skip(offset).take(page_size as usize).collect();
    Ok(TemplatePage { entries, total, page, page_size })
}

#[tauri::command(rename_all = "camelCase")]
pub fn upsert_template(
    state: State<'_, AppState>,
    id: Option<i64>,
    title: String,
    text: String,
    content_type: Option<String>,
    image_data: Option<String>,
    group_id: Option<i64>,
    new_group_name: Option<String>,
) -> Result<(), String> {
    state.template_store.upsert_template(UpsertTemplateInput {
        id,
        title,
        text,
        content_type,
        image_data,
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

    // ウィンドウを隠してフォーカスを元のアプリに戻してからペースト
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(100));

    if template.content_type == "image" {
        if let Some(ref b64) = template.image_data {
            use base64::Engine;
            let png_bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 decode error: {e}"))?;
            let dib_data = crate::services::image_util::png_to_dib(&png_bytes)?;
            return state
                .paste_service
                .paste_image(&dib_data, state.clipboard_guard.clone());
        }
    }

    let clipboard_text = state.paste_service.get_clipboard_text()?;
    let rendered = state
        .template_store
        .render_placeholders(&template.text, &clipboard_text);
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
