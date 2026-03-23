use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, State,
};

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPayload {
    pub text: Option<String>,
    pub image_data: Option<String>,
    pub char_count: Option<usize>,
    pub copied_at: Option<String>,
}

/// Shared state to hold the latest preview data so the preview window
/// can fetch it on mount (before event listeners are set up).
pub struct PreviewState {
    pub latest: Mutex<Option<PreviewPayload>>,
    /// Timestamp of the last show_preview call, used by the blur handler
    /// to avoid hiding windows immediately after preview is shown.
    pub shown_at: Mutex<Option<Instant>>,
}

#[tauri::command(rename_all = "camelCase")]
pub fn show_preview(
    app: AppHandle,
    app_state: State<'_, AppState>,
    state: State<'_, PreviewState>,
    payload: PreviewPayload,
    anchor_y: Option<i32>,
) -> Result<(), String> {
    let settings = app_state.settings_service.load().unwrap_or_default();

    let main_window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    let main_pos = main_window
        .outer_position()
        .map_err(|e| e.to_string())?;
    let main_size = main_window.outer_size().map_err(|e| e.to_string())?;

    // Use larger size for image previews
    let is_image = payload.image_data.is_some();
    let pw = if is_image { settings.preview_image_width } else { settings.preview_width };
    let ph = if is_image { settings.preview_image_height } else { settings.preview_height };

    // Determine preview X: prefer right of main window, fall back to left
    let right_edge = main_pos.x + main_size.width as i32;
    let (preview_x, screen_bottom) = if let Ok(Some(monitor)) =
        app.monitor_from_point(main_pos.x as f64, main_pos.y as f64)
    {
        let work_area = monitor.work_area();
        let screen_right = work_area.position.x + work_area.size.width as i32;
        let sb = work_area.position.y + work_area.size.height as i32;
        let px = if right_edge + pw as i32 + 1 <= screen_right {
            right_edge + 1
        } else {
            main_pos.x - pw as i32 - 1
        };
        (px, sb)
    } else {
        (right_edge + 1, main_pos.y + main_size.height as i32)
    };

    // Determine preview Y: align with selected item, clamped to screen
    let preview_y = if let Some(ay) = anchor_y {
        // anchor_y is viewport-relative; convert to screen-absolute
        let abs_y = main_pos.y + ay;
        // Clamp so the preview window stays within the screen
        abs_y.max(main_pos.y).min(screen_bottom - ph as i32)
    } else {
        main_pos.y
    };

    // Store payload so the preview window can fetch it via get_preview_data on mount
    if let Ok(mut latest) = state.latest.lock() {
        *latest = Some(payload.clone());
    }
    // Record timestamp so the blur handler knows preview was just shown
    if let Ok(mut shown_at) = state.shown_at.lock() {
        *shown_at = Some(Instant::now());
    }

    // Preview window is created by show_popup() on the main thread.
    // If it doesn't exist yet, skip silently (first show_preview may fire
    // before the user opens the popup).
    let preview = match app.get_webview_window("preview") {
        Some(w) => w,
        None => {
            eprintln!("[show_preview] preview window not ready yet, skipping");
            return Ok(());
        }
    };

    preview
        .set_size(Size::Physical(PhysicalSize::new(pw, ph)))
        .map_err(|e| e.to_string())?;
    preview
        .set_position(Position::Physical(PhysicalPosition::new(
            preview_x, preview_y,
        )))
        .map_err(|e| e.to_string())?;

    // Send content to the preview window (works if JS is already loaded)
    let _ = app.emit_to("preview", "preview://update", &payload);

    preview.show().map_err(|e| e.to_string())?;

    // Return focus to main window
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

/// Called by PreviewPanel on mount to get the latest preview data
#[tauri::command]
pub fn get_preview_data(state: State<'_, PreviewState>) -> Result<Option<PreviewPayload>, String> {
    let data = state
        .latest
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    Ok(data)
}
