use std::path::Path;

#[cfg(windows)]
use std::mem::size_of;
#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::Duration;

#[cfg(windows)]
use clipboard_win::{get_clipboard_string, set_clipboard_string};
#[cfg(windows)]
use windows::Win32::Foundation::POINT;
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, VIRTUAL_KEY, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
#[cfg(windows)]
use windows::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, OpenClipboard, SetClipboardData, EmptyClipboard,
};
#[cfg(windows)]
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};
#[cfg(windows)]
use windows::Win32::Foundation::{HANDLE, HGLOBAL};
#[cfg(windows)]
use winreg::enums::{HKEY_CURRENT_USER, KEY_ALL_ACCESS};
#[cfg(windows)]
use winreg::RegKey;

#[cfg(windows)]
const CF_DIB: u32 = 8;

#[cfg(windows)]
pub fn cursor_position() -> Result<(i32, i32), String> {
    let mut point = POINT::default();
    unsafe {
        GetCursorPos(&mut point).map_err(|error| error.to_string())?;
    }
    Ok((point.x, point.y))
}

#[cfg(not(windows))]
pub fn cursor_position() -> Result<(i32, i32), String> {
    Ok((120, 120))
}

/// Try to open the clipboard up to 3 times (10 ms apart) to handle transient locks held by
/// other processes.  Returns true if the clipboard was opened successfully.
#[cfg(windows)]
fn open_clipboard_with_retry() -> bool {
    for _ in 0..3 {
        unsafe {
            if OpenClipboard(None).is_ok() {
                return true;
            }
        }
        thread::sleep(Duration::from_millis(10));
    }
    false
}

#[cfg(windows)]
pub fn get_clipboard_text() -> Result<Option<String>, String> {
    // Retry up to 3 times; clipboard_win opens/closes clipboard internally
    for _ in 0..3 {
        match get_clipboard_string() {
            Ok(text) => return Ok(Some(text)),
            Err(_) => thread::sleep(Duration::from_millis(10)),
        }
    }
    Ok(None)
}

#[cfg(not(windows))]
pub fn get_clipboard_text() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(windows)]
pub fn set_clipboard_text(text: &str) -> Result<(), String> {
    set_clipboard_string(text).map_err(|error| error.to_string())
}

#[cfg(not(windows))]
pub fn set_clipboard_text(_text: &str) -> Result<(), String> {
    Ok(())
}

/// Get image data from clipboard as raw DIB bytes.
/// Returns None if no image is on the clipboard.
#[cfg(windows)]
pub fn get_clipboard_image() -> Result<Option<Vec<u8>>, String> {
    unsafe {
        if !open_clipboard_with_retry() {
            return Ok(None);
        }

        let result = (|| -> Result<Option<Vec<u8>>, String> {
            let handle = match GetClipboardData(CF_DIB) {
                Ok(h) => h,
                Err(_) => return Ok(None),
            };
            let hmem = HGLOBAL(handle.0);

            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                return Ok(None);
            }

            let size = GlobalSize(hmem);
            if size == 0 {
                let _ = GlobalUnlock(hmem);
                return Ok(None);
            }

            let data = std::slice::from_raw_parts(ptr as *const u8, size);
            let result = data.to_vec();

            let _ = GlobalUnlock(hmem);
            Ok(Some(result))
        })();

        let _ = CloseClipboard();
        result
    }
}

/// Check for an image AND read it in a single clipboard open/close session to avoid the TOCTOU
/// race between a separate has_image check and a subsequent get_image call.
/// Returns None if the clipboard holds no image or is unavailable.
#[cfg(windows)]
pub fn try_get_clipboard_image() -> Option<Vec<u8>> {
    if !open_clipboard_with_retry() {
        return None;
    }
    unsafe {
        let result = (|| -> Option<Vec<u8>> {
            let handle = GetClipboardData(CF_DIB).ok()?;
            let hmem = HGLOBAL(handle.0);
            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                return None;
            }
            let size = GlobalSize(hmem);
            let data = if size > 0 {
                Some(std::slice::from_raw_parts(ptr as *const u8, size).to_vec())
            } else {
                None
            };
            let _ = GlobalUnlock(hmem);
            data
        })();
        let _ = CloseClipboard();
        result
    }
}

#[cfg(not(windows))]
pub fn try_get_clipboard_image() -> Option<Vec<u8>> {
    None
}

#[cfg(not(windows))]
pub fn get_clipboard_image() -> Result<Option<Vec<u8>>, String> {
    Ok(None)
}

/// Set image data (raw DIB) to the clipboard.
#[cfg(windows)]
pub fn set_clipboard_image(dib_data: &[u8]) -> Result<(), String> {
    unsafe {
        OpenClipboard(None).map_err(|e| e.to_string())?;

        let result = (|| -> Result<(), String> {
            EmptyClipboard().map_err(|e| e.to_string())?;

            let hmem = GlobalAlloc(GMEM_MOVEABLE, dib_data.len())
                .map_err(|e| e.to_string())?;
            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                return Err("GlobalLock failed".into());
            }

            std::ptr::copy_nonoverlapping(dib_data.as_ptr(), ptr as *mut u8, dib_data.len());
            let _ = GlobalUnlock(hmem);

            let handle = HANDLE(hmem.0);
            SetClipboardData(CF_DIB, Some(handle))
                .map_err(|e| e.to_string())?;
            Ok(())
        })();

        let _ = CloseClipboard();
        result
    }
}

#[cfg(not(windows))]
pub fn set_clipboard_image(_dib_data: &[u8]) -> Result<(), String> {
    Ok(())
}

/// Check if clipboard currently contains an image (CF_DIB).
#[cfg(windows)]
pub fn clipboard_has_image() -> bool {
    if !open_clipboard_with_retry() {
        return false;
    }
    unsafe {
        let has = GetClipboardData(CF_DIB).is_ok();
        let _ = CloseClipboard();
        has
    }
}

#[cfg(not(windows))]
pub fn clipboard_has_image() -> bool {
    false
}

#[cfg(windows)]
pub fn send_ctrl_v() -> Result<(), String> {
    let inputs = [
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(VK_CONTROL.0 as u16),
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(b'V' as u16),
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(b'V' as u16),
                    dwFlags: KEYEVENTF_KEYUP,
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(VK_CONTROL.0 as u16),
                    dwFlags: KEYEVENTF_KEYUP,
                    ..Default::default()
                },
            },
        },
    ];

    unsafe {
        let sent = SendInput(&inputs, size_of::<INPUT>() as i32);
        if sent != inputs.len() as u32 {
            return Err("SendInput failed".into());
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn send_ctrl_v() -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn set_launch_on_startup(app_name: &str, executable: &Path, enabled: bool) -> Result<(), String> {
    let hkey = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Run", KEY_ALL_ACCESS)
        .map_err(|error| error.to_string())?;

    if enabled {
        hkey.set_value(app_name, &executable.display().to_string())
            .map_err(|error| error.to_string())?;
    } else {
        let _ = hkey.delete_value(app_name);
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn set_launch_on_startup(
    _app_name: &str,
    _executable: &Path,
    _enabled: bool,
) -> Result<(), String> {
    Ok(())
}

/// Returns the PID of the process that owns the current foreground window.
#[cfg(windows)]
pub fn foreground_window_pid() -> Result<u32, String> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return Err("no foreground window".into());
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        Ok(pid)
    }
}

#[cfg(not(windows))]
pub fn foreground_window_pid() -> Result<u32, String> {
    Err("not implemented".into())
}
