use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindowBuilder,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPayload {
    pub text: Option<String>,
    pub image_data: Option<String>,
    pub char_count: Option<usize>,
    pub copied_at: Option<String>,
}

const PREVIEW_WIDTH: u32 = 320;
const PREVIEW_HEIGHT: u32 = 400;

#[tauri::command]
pub fn show_preview(app: AppHandle, payload: PreviewPayload) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    let main_pos = main_window
        .outer_position()
        .map_err(|e| e.to_string())?;
    let main_size = main_window.outer_size().map_err(|e| e.to_string())?;

    // Determine preview position: prefer right of main window, fall back to left
    let right_edge = main_pos.x + main_size.width as i32;
    let preview_x = if let Ok(Some(monitor)) =
        app.monitor_from_point(main_pos.x as f64, main_pos.y as f64)
    {
        let work_area = monitor.work_area();
        let screen_right = work_area.position.x + work_area.size.width as i32;
        if right_edge + PREVIEW_WIDTH as i32 + 4 <= screen_right {
            right_edge + 4
        } else {
            main_pos.x - PREVIEW_WIDTH as i32 - 4
        }
    } else {
        right_edge + 4
    };

    let preview_y = main_pos.y;

    let preview = if let Some(w) = app.get_webview_window("preview") {
        w
    } else {
        WebviewWindowBuilder::new(
            &app,
            "preview",
            WebviewUrl::default(),
        )
        .title("Preview")
        .inner_size(PREVIEW_WIDTH as f64, PREVIEW_HEIGHT as f64)
        .visible(false)
        .decorations(false)
        .transparent(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .build()
        .map_err(|e| e.to_string())?
    };

    preview
        .set_size(Size::Physical(PhysicalSize::new(
            PREVIEW_WIDTH,
            PREVIEW_HEIGHT,
        )))
        .map_err(|e| e.to_string())?;
    preview
        .set_position(Position::Physical(PhysicalPosition::new(
            preview_x, preview_y,
        )))
        .map_err(|e| e.to_string())?;

    // Emit content to the preview window
    app.emit_to("preview", "preview://update", &payload)
        .map_err(|e| e.to_string())?;

    preview.show().map_err(|e| e.to_string())?;

    // Return focus to main window (preview should not steal focus)
    let _ = main_window.set_focus();

    Ok(())
}

#[tauri::command]
pub fn hide_preview(app: AppHandle) -> Result<(), String> {
    if let Some(preview) = app.get_webview_window("preview") {
        let _ = preview.hide();
    }
    Ok(())
}
