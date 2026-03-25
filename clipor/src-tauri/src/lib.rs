mod commands;
mod models;
mod native;
mod services;

use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

use crate::commands::clipboard::{
    delete_history_entry, get_history, paste_history_entry, set_clipboard_converted,
    set_clipboard_formatted, set_clipboard_text_converted, set_clipboard_text_formatted,
    set_history_pinned, transform_and_paste, update_history_entry,
};
use crate::commands::preview::{get_preview_data, hide_preview, show_preview, PreviewState};
use crate::commands::settings::{
    force_reset_password, get_settings, remove_password, set_password, update_settings,
    verify_password,
};
use crate::commands::template::{
    delete_template, export_templates, get_template_groups, get_templates, import_templates,
    paste_template, upsert_template,
};
use crate::models::app_settings::AppSettings;
use crate::services::clipboard_history_store::ClipboardHistoryStore;
use crate::services::clipboard_monitor::spawn_monitor;
use crate::services::hotkey_detector::spawn_hotkey_listener;
use crate::services::paste_service::PasteService;
use crate::services::settings_service::SettingsService;
use crate::services::template_store::TemplateStore;

const TRAY_ICON: tauri::image::Image<'_> = tauri::include_image!("src/icons/tray.png");
const POPUP_WIDTH: i32 = 230;
const POPUP_HEIGHT: i32 = 720;
const POPUP_MARGIN: i32 = 24;

pub struct AppState {
    history_store: ClipboardHistoryStore,
    template_store: TemplateStore,
    settings_service: SettingsService,
    paste_service: PasteService,
    clipboard_guard: Arc<AtomicBool>,
}

pub fn run() {
    let base_dir = app_base_dir();
    let db_path = base_dir.join("history.db");
    let settings_path = base_dir.join("settings.json");
    let encryption_key = Arc::new(Mutex::new(None));
    let history_store = ClipboardHistoryStore::new(db_path.clone(), encryption_key.clone());
    let template_store = TemplateStore::new(db_path, encryption_key);
    let settings_service = SettingsService::new(settings_path);
    let paste_service = PasteService;
    let clipboard_guard = Arc::new(AtomicBool::new(false));
    let popup_shown_at = Arc::new(Mutex::new(None::<Instant>));

    history_store.initialize().expect("initialize database");
    let settings = settings_service.load().unwrap_or_else(|_| AppSettings::default());
    let _ = settings_service.save(&settings);

    // Clean up orphaned encrypted entries when password is not configured.
    // This handles the case where password was force-reset or settings were manually cleared.
    if !settings.require_password {
        let _ = history_store.delete_encrypted_entries();
        let _ = template_store.delete_encrypted_entries();
    }

    tauri::Builder::default()
        .on_window_event({
            let history_store = history_store.clone();
            let settings_service = settings_service.clone();
            let popup_shown_at = popup_shown_at.clone();
            move |window, event| {
                if window.label() == "main" && matches!(event, WindowEvent::Focused(false)) {
                    // Skip blur if popup was never shown (startup blur events)
                    let ever_shown = popup_shown_at
                        .lock()
                        .ok()
                        .and_then(|shown_at| *shown_at)
                        .is_some();
                    if !ever_shown {
                        eprintln!("[blur] ignoring — popup never shown yet");
                        return;
                    }

                    let settings = settings_service.load().unwrap_or_default();
                    let require_pw = settings.require_password;
                    let blur_delay_ms = settings.blur_delay_ms;
                    let has_key = history_store.has_encryption_key();
                    let locked = require_pw && !has_key;
                    eprintln!(
                        "[blur] require_password={}, has_encryption_key={}, locked={}",
                        require_pw, has_key, locked
                    );
                    if locked {
                        return;
                    }

                    let recently_shown = popup_shown_at
                        .lock()
                        .ok()
                        .and_then(|shown_at| *shown_at)
                        .map(|shown_at| shown_at.elapsed() < Duration::from_millis(800))
                        .unwrap_or(false);

                    if recently_shown {
                        eprintln!("[blur] ignoring — popup recently shown");
                        return;
                    }

                    // Delay check to allow focus transitions
                    let app = window.app_handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(Duration::from_millis(blur_delay_ms));

                        // Check if preview was recently shown
                        let preview_recently_shown = app
                            .try_state::<PreviewState>()
                            .and_then(|ps| ps.shown_at.lock().ok().and_then(|t| *t))
                            .map(|t| t.elapsed() < Duration::from_millis(500))
                            .unwrap_or(false);
                        if preview_recently_shown {
                            eprintln!("[blur-check] preview recently shown, re-focusing main");
                            if let Some(mw) = app.get_webview_window("main") {
                                let _ = mw.set_focus();
                            }
                            return;
                        }

                        // Check foreground window via Win32 API
                        let our_pid = std::process::id();
                        let fg_is_ours = crate::native::win32::foreground_window_pid()
                            .map(|pid| pid == our_pid)
                            .unwrap_or(false);

                        if fg_is_ours {
                            return;
                        }

                        // Check if cursor is over the main or preview window
                        // (user may be moving mouse between them)
                        let cursor_over_our_window = (|| -> bool {
                            let (cx, cy) = match crate::native::win32::cursor_position() {
                                Ok(pos) => pos,
                                Err(_) => return false,
                            };
                            for label in &["main", "preview"] {
                                if let Some(w) = app.get_webview_window(label) {
                                    if let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) {
                                        if cx >= pos.x
                                            && cx <= pos.x + size.width as i32
                                            && cy >= pos.y
                                            && cy <= pos.y + size.height as i32
                                        {
                                            return true;
                                        }
                                    }
                                }
                            }
                            false
                        })();

                        if cursor_over_our_window {
                            // Cursor is still over our windows — re-focus main
                            if let Some(mw) = app.get_webview_window("main") {
                                let _ = mw.set_focus();
                            }
                            return;
                        }

                        eprintln!("[blur-check] hiding both windows");
                        if let Some(mw) = app.get_webview_window("main") {
                            let _ = mw.hide();
                        }
                        if let Some(pw) = app.get_webview_window("preview") {
                            let _ = pw.hide();
                        }
                    });
                }

                // Preview window blur: no action needed.
                // Preview is hidden by JS (mouseLeave → hide_preview command)
                // and by main's blur handler (both windows hide together).
            }
        })
        .manage(AppState {
            history_store: history_store.clone(),
            template_store: template_store.clone(),
            settings_service: settings_service.clone(),
            paste_service: paste_service.clone(),
            clipboard_guard: clipboard_guard.clone(),
        })
        .manage(PreviewState {
            latest: Mutex::new(None),
            shown_at: Mutex::new(None),
        })
        .setup(move |app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Clipor")
                .inner_size(POPUP_WIDTH as f64, POPUP_HEIGHT as f64)
                .visible(false)
                .decorations(false)
                .transparent(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .build()?;

            let _ = window.hide();

            let tray_menu = MenuBuilder::new(app)
                .text("show_history", "履歴を表示")
                .text("show_templates", "定型文を表示")
                .text("open_settings", "設定")
                .separator()
                .text("quit", "終了")
                .build()?;

            let popup_shown_at_for_menu = popup_shown_at.clone();
            let _tray = TrayIconBuilder::with_id("clipor-tray")
                .icon(TRAY_ICON.clone())
                .tooltip("Clipor")
                .menu(&tray_menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show_history" => {
                        let _ = show_popup(app, &popup_shown_at_for_menu);
                        let _ = app.emit("ui://select-tab", "history");
                    }
                    "show_templates" => {
                        let _ = show_popup(app, &popup_shown_at_for_menu);
                        let _ = app.emit("ui://select-tab", "templates");
                    }
                    "open_settings" => {
                        let _ = show_popup(app, &popup_shown_at_for_menu);
                        let _ = app.emit("ui://select-tab", "settings");
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            spawn_monitor(
                history_store.clone(),
                settings_service.clone(),
                clipboard_guard.clone(),
            );

            let app_handle = app.handle().clone();
            let popup_shown_at = popup_shown_at.clone();
            spawn_hotkey_listener(settings_service.clone(), move || {
                let _ = show_popup(&app_handle, &popup_shown_at);
                let _ = app_handle.emit("hotkey://toggle-popup", ());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_history,
            paste_history_entry,
            update_history_entry,
            set_history_pinned,
            delete_history_entry,
            set_clipboard_formatted,
            set_clipboard_converted,
            set_clipboard_text_formatted,
            set_clipboard_text_converted,
            transform_and_paste,
            get_template_groups,
            get_templates,
            upsert_template,
            delete_template,
            paste_template,
            export_templates,
            import_templates,
            get_settings,
            update_settings,
            set_password,
            verify_password,
            remove_password,
            force_reset_password,
            show_preview,
            hide_preview,
            get_preview_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn app_base_dir() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::env::current_dir().expect("current dir"))
        .join("Clipor")
}

fn show_popup(app: &AppHandle, popup_shown_at: &Arc<Mutex<Option<Instant>>>) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let (cursor_x, cursor_y) = native::win32::cursor_position()?;
    let mut target_width = POPUP_WIDTH;
    let mut target_height = POPUP_HEIGHT;
    let mut target_x = cursor_x;
    let mut target_y = cursor_y;

    if let Some(monitor) = app
        .monitor_from_point(cursor_x as f64, cursor_y as f64)
        .map_err(|error| error.to_string())?
        .or(app.primary_monitor().map_err(|error| error.to_string())?)
    {
        let work_area = monitor.work_area();
        let min_x = work_area.position.x;
        let min_y = work_area.position.y;
        let max_x = min_x + work_area.size.width as i32;
        let max_y = min_y + work_area.size.height as i32;
        let available_height = (work_area.size.height as i32 - POPUP_MARGIN * 2).max(280);

        target_width = POPUP_WIDTH;
        target_height = POPUP_HEIGHT.min(available_height);

        // Position at cursor, but clamp so the window stays within the work area
        target_x = cursor_x.max(min_x).min(max_x - target_width);
        target_y = cursor_y.max(min_y).min(max_y - target_height);
    }

    if let Ok(mut shown_at) = popup_shown_at.lock() {
        *shown_at = Some(Instant::now());
    }

    window
        .set_size(Size::Physical(PhysicalSize::new(
            target_width.max(230) as u32,
            target_height.max(280) as u32,
        )))
        .map_err(|error| error.to_string())?;
    window
        .set_position(Position::Physical(PhysicalPosition::new(target_x, target_y)))
        .map_err(|error| error.to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    // Ensure preview window exists (create lazily on first popup show).
    // Must be created here (main thread context) — WebviewWindowBuilder::build()
    // deadlocks when called from a Tauri command handler thread.
    if app.get_webview_window("preview").is_none() {
        let _ = WebviewWindowBuilder::new(app, "preview", WebviewUrl::default())
            .title("Preview")
            .inner_size(320.0, 400.0)
            .visible(false)
            .decorations(false)
            .transparent(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .build();
    }

    Ok(())
}
