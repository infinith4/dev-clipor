use crate::services::settings_service::SettingsService;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hotkey {
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
    key: HotkeyKey,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum HotkeyKey {
    Letter(char),
    Digit(char),
    Enter,
    Escape,
    Space,
    Tab,
    F(u8),
}

pub fn normalize_hotkey(input: &str) -> Result<String, String> {
    Hotkey::parse(input).map(|hotkey| hotkey.to_string())
}

impl Hotkey {
    fn parse(input: &str) -> Result<Self, String> {
        let mut ctrl = false;
        let mut alt = false;
        let mut shift = false;
        let mut meta = false;
        let mut key = None;

        for token in input.split('+').map(str::trim).filter(|token| !token.is_empty()) {
            let normalized = token.to_ascii_lowercase();
            match normalized.as_str() {
                "ctrl" | "control" => ctrl = true,
                "alt" => alt = true,
                "shift" => shift = true,
                "meta" | "win" | "super" | "cmd" => meta = true,
                _ => {
                    if key.is_some() {
                        return Err("ホットキーは1つのメインキーだけ指定できます。".into());
                    }
                    key = Some(parse_main_key(&normalized)?);
                }
            }
        }

        let key = key.ok_or_else(|| "ホットキーにメインキーを含めてください。".to_string())?;
        if !(ctrl || alt || shift || meta) {
            return Err("ホットキーには Ctrl / Alt / Shift / Meta のいずれかを含めてください。".into());
        }

        Ok(Self {
            ctrl,
            alt,
            shift,
            meta,
            key,
        })
    }

    #[cfg(windows)]
    fn windows_modifiers(&self) -> windows::Win32::UI::Input::KeyboardAndMouse::HOT_KEY_MODIFIERS {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, MOD_WIN,
        };

        let mut modifiers = HOT_KEY_MODIFIERS(0);
        if self.ctrl {
            modifiers |= MOD_CONTROL;
        }
        if self.alt {
            modifiers |= MOD_ALT;
        }
        if self.shift {
            modifiers |= MOD_SHIFT;
        }
        if self.meta {
            modifiers |= MOD_WIN;
        }
        modifiers | MOD_NOREPEAT
    }

    #[cfg(windows)]
    fn windows_virtual_key(&self) -> u32 {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            VK_ESCAPE, VK_F1, VK_F10, VK_F11, VK_F12, VK_F2, VK_F3, VK_F4, VK_F5, VK_F6, VK_F7,
            VK_F8, VK_F9, VK_RETURN, VK_SPACE, VK_TAB,
        };

        match self.key {
            HotkeyKey::Letter(letter) => letter as u32,
            HotkeyKey::Digit(digit) => digit as u32,
            HotkeyKey::Enter => VK_RETURN.0 as u32,
            HotkeyKey::Escape => VK_ESCAPE.0 as u32,
            HotkeyKey::Space => VK_SPACE.0 as u32,
            HotkeyKey::Tab => VK_TAB.0 as u32,
            HotkeyKey::F(1) => VK_F1.0 as u32,
            HotkeyKey::F(2) => VK_F2.0 as u32,
            HotkeyKey::F(3) => VK_F3.0 as u32,
            HotkeyKey::F(4) => VK_F4.0 as u32,
            HotkeyKey::F(5) => VK_F5.0 as u32,
            HotkeyKey::F(6) => VK_F6.0 as u32,
            HotkeyKey::F(7) => VK_F7.0 as u32,
            HotkeyKey::F(8) => VK_F8.0 as u32,
            HotkeyKey::F(9) => VK_F9.0 as u32,
            HotkeyKey::F(10) => VK_F10.0 as u32,
            HotkeyKey::F(11) => VK_F11.0 as u32,
            HotkeyKey::F(12) => VK_F12.0 as u32,
            HotkeyKey::F(_) => unreachable!("function keys are validated in parse_main_key"),
        }
    }
}

impl std::fmt::Display for Hotkey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut tokens = Vec::new();
        if self.ctrl {
            tokens.push("Ctrl".to_string());
        }
        if self.alt {
            tokens.push("Alt".to_string());
        }
        if self.shift {
            tokens.push("Shift".to_string());
        }
        if self.meta {
            tokens.push("Meta".to_string());
        }
        tokens.push(match self.key {
            HotkeyKey::Letter(letter) => letter.to_string(),
            HotkeyKey::Digit(digit) => digit.to_string(),
            HotkeyKey::Enter => "Enter".to_string(),
            HotkeyKey::Escape => "Escape".to_string(),
            HotkeyKey::Space => "Space".to_string(),
            HotkeyKey::Tab => "Tab".to_string(),
            HotkeyKey::F(number) => format!("F{number}"),
        });
        write!(f, "{}", tokens.join("+"))
    }
}

fn parse_main_key(token: &str) -> Result<HotkeyKey, String> {
    if token.len() == 1 {
        let character = token.chars().next().unwrap();
        if character.is_ascii_alphabetic() {
            return Ok(HotkeyKey::Letter(character.to_ascii_uppercase()));
        }
        if character.is_ascii_digit() {
            return Ok(HotkeyKey::Digit(character));
        }
    }

    match token {
        "enter" | "return" => Ok(HotkeyKey::Enter),
        "esc" | "escape" => Ok(HotkeyKey::Escape),
        "space" | "spacebar" => Ok(HotkeyKey::Space),
        "tab" => Ok(HotkeyKey::Tab),
        _ if token.starts_with('f') => token[1..]
            .parse::<u8>()
            .ok()
            .filter(|value| (1..=12).contains(value))
            .map(HotkeyKey::F)
            .ok_or_else(|| "サポートされていないファンクションキーです。".into()),
        _ => Err("サポートされていないホットキーです。例: Ctrl+Alt+Z".into()),
    }
}

#[cfg(windows)]
pub fn spawn_hotkey_listener<F>(settings_service: SettingsService, callback: F)
where
    F: Fn() + Send + Sync + 'static,
{
    use std::thread;
    use std::time::Duration;

    use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey};
    use windows::Win32::UI::WindowsAndMessaging::{PeekMessageW, MSG, PM_REMOVE, WM_HOTKEY};

    const HOTKEY_ID: i32 = 1;

    thread::spawn(move || {
        let mut registered_hotkey = String::new();

        loop {
            let desired_hotkey = settings_service
                .load()
                .ok()
                .and_then(|settings| normalize_hotkey(&settings.hotkey).ok())
                .unwrap_or_else(|| "Ctrl+Alt+Z".to_string());

            if desired_hotkey != registered_hotkey {
                unsafe {
                    let _ = UnregisterHotKey(None, HOTKEY_ID);
                }

                if let Ok(hotkey) = Hotkey::parse(&desired_hotkey) {
                    let register_result = unsafe {
                        RegisterHotKey(
                            None,
                            HOTKEY_ID,
                            hotkey.windows_modifiers(),
                            hotkey.windows_virtual_key(),
                        )
                    };

                    if register_result.is_ok() {
                        registered_hotkey = desired_hotkey;
                    }
                }
            }

            let mut message = MSG::default();
            loop {
                let has_message =
                    unsafe { PeekMessageW(&mut message, None, WM_HOTKEY, WM_HOTKEY, PM_REMOVE) };
                if !has_message.as_bool() {
                    break;
                }
                if message.message == WM_HOTKEY && message.wParam.0 == HOTKEY_ID as usize {
                    callback();
                }
            }

            thread::sleep(Duration::from_millis(50));
        }
    });
}

#[cfg(not(windows))]
pub fn spawn_hotkey_listener<F>(_settings_service: SettingsService, _callback: F)
where
    F: Fn() + Send + Sync + 'static,
{
}

#[cfg(test)]
mod tests {
    use super::{normalize_hotkey, Hotkey};

    #[test]
    fn normalizes_hotkey_text() {
        assert_eq!(normalize_hotkey("ctrl + alt + m").unwrap(), "Ctrl+Alt+M");
    }

    #[test]
    fn rejects_hotkey_without_modifier() {
        assert!(normalize_hotkey("M").is_err());
    }

    #[test]
    fn parses_function_key_hotkey() {
        let hotkey = Hotkey::parse("Alt+F2").unwrap();
        assert_eq!(hotkey.to_string(), "Alt+F2");
    }

    #[test]
    fn rejects_multiple_main_keys() {
        assert!(Hotkey::parse("Ctrl+Alt+Z+K").is_err());
    }
}
