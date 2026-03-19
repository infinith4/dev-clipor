use tauri::State;

use crate::models::app_settings::AppSettings;
use crate::services::crypto_service;
use crate::AppState;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let mut settings = state.settings_service.load()?;
    // Don't expose sensitive fields to frontend
    settings.password_salt = None;
    settings.password_verify = None;
    Ok(settings)
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    // Preserve password fields from existing settings
    let existing = state.settings_service.load().unwrap_or_default();
    let mut merged = settings;
    merged.require_password = existing.require_password;
    merged.password_salt = existing.password_salt;
    merged.password_verify = existing.password_verify;
    state.settings_service.save(&merged)
}

#[tauri::command]
pub fn set_password(state: State<'_, AppState>, password: String) -> Result<(), String> {
    if password.is_empty() {
        return Err("パスワードを入力してください。".to_string());
    }

    let salt = crypto_service::generate_salt()?;
    let (key, verify) = crypto_service::derive_key_and_verify(&password, &salt);

    // Encrypt all existing plaintext DB data.
    state.history_store.encrypt_all_entries(&key)?;
    state.template_store.encrypt_all_entries(&key)?;

    // Store key in memory
    {
        let mut key_guard = state
            .history_store
            .encryption_key
            .lock()
            .map_err(|e| e.to_string())?;
        *key_guard = Some(key);
    }

    // Update settings
    let mut settings = state.settings_service.load().unwrap_or_default();
    settings.require_password = true;
    settings.password_salt = Some(crypto_service::hex_encode(&salt));
    settings.password_verify = Some(crypto_service::hex_encode(&verify));
    state.settings_service.save(&settings)?;

    Ok(())
}

#[tauri::command]
pub fn verify_password(state: State<'_, AppState>, password: String) -> Result<bool, String> {
    let settings = state.settings_service.load()?;

    let salt_hex = settings
        .password_salt
        .as_deref()
        .ok_or("パスワードが設定されていません。")?;
    let verify_hex = settings
        .password_verify
        .as_deref()
        .ok_or("パスワードが設定されていません。")?;

    let salt = crypto_service::hex_decode(salt_hex)?;
    let expected_verify = crypto_service::hex_decode(verify_hex)?;

    let (key, actual_verify) = crypto_service::derive_key_and_verify(&password, &salt);

    if actual_verify.as_slice() != expected_verify.as_slice() {
        return Ok(false);
    }

    // Store key in memory
    let mut key_guard = state
        .history_store
        .encryption_key
        .lock()
        .map_err(|e| e.to_string())?;
    *key_guard = Some(key);

    Ok(true)
}

#[tauri::command]
pub fn remove_password(
    state: State<'_, AppState>,
    current_password: String,
) -> Result<(), String> {
    let settings = state.settings_service.load()?;

    let salt_hex = settings
        .password_salt
        .as_deref()
        .ok_or("パスワードが設定されていません。")?;
    let verify_hex = settings
        .password_verify
        .as_deref()
        .ok_or("パスワードが設定されていません。")?;

    let salt = crypto_service::hex_decode(salt_hex)?;
    let expected_verify = crypto_service::hex_decode(verify_hex)?;

    let (key, actual_verify) = crypto_service::derive_key_and_verify(&current_password, &salt);

    if actual_verify.as_slice() != expected_verify.as_slice() {
        return Err("パスワードが正しくありません。".to_string());
    }

    // Decrypt all encrypted DB data.
    state.history_store.decrypt_all_entries(&key)?;
    state.template_store.decrypt_all_entries(&key)?;

    // Clear key from memory
    {
        let mut key_guard = state
            .history_store
            .encryption_key
            .lock()
            .map_err(|e| e.to_string())?;
        *key_guard = None;
    }

    // Update settings
    let mut settings = state.settings_service.load().unwrap_or_default();
    settings.require_password = false;
    settings.password_salt = None;
    settings.password_verify = None;
    state.settings_service.save(&settings)?;

    Ok(())
}
