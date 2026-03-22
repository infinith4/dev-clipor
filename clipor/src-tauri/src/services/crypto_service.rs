use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use pbkdf2::pbkdf2_hmac_array;
use sha2::Sha256;

#[cfg(debug_assertions)]
const PBKDF2_ITERATIONS: u32 = 1_000;
#[cfg(not(debug_assertions))]
const PBKDF2_ITERATIONS: u32 = 100_000;
const NONCE_LEN: usize = 12;

pub fn generate_salt() -> Result<[u8; 32], String> {
    let mut salt = [0u8; 32];
    getrandom::getrandom(&mut salt).map_err(|e| format!("乱数生成に失敗: {e}"))?;
    Ok(salt)
}

/// Derives a 32-byte encryption key and a 32-byte verification hash from password + salt.
pub fn derive_key_and_verify(password: &str, salt: &[u8]) -> ([u8; 32], [u8; 32]) {
    let derived = pbkdf2_hmac_array::<Sha256, 64>(password.as_bytes(), salt, PBKDF2_ITERATIONS);
    let mut key = [0u8; 32];
    let mut verify = [0u8; 32];
    key.copy_from_slice(&derived[..32]);
    verify.copy_from_slice(&derived[32..]);
    (key, verify)
}

/// Encrypts plaintext with AES-256-GCM. Returns base64(nonce || ciphertext).
pub fn encrypt_text(plaintext: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce_bytes = [0u8; NONCE_LEN];
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| format!("乱数生成に失敗: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("暗号化に失敗しました: {e}"))?;

    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    Ok(BASE64.encode(&combined))
}

/// Decrypts base64-encoded ciphertext with AES-256-GCM.
pub fn decrypt_text(encrypted: &str, key: &[u8; 32]) -> Result<String, String> {
    let combined = BASE64
        .decode(encrypted)
        .map_err(|e| format!("Base64デコードに失敗: {e}"))?;

    if combined.len() < NONCE_LEN + 16 {
        return Err("暗号化データが不正です".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("復号に失敗しました: {e}"))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8変換に失敗: {e}"))
}

pub fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("不正な16進数文字列です".to_string());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let salt = generate_salt().unwrap();
        let (key, _verify) = derive_key_and_verify("test-password", &salt);
        let plaintext = "Hello, World! これはテストです。";
        let encrypted = encrypt_text(plaintext, &key).unwrap();
        let decrypted = decrypt_text(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_key_fails() {
        let salt = generate_salt().unwrap();
        let (key1, _) = derive_key_and_verify("password1", &salt);
        let (key2, _) = derive_key_and_verify("password2", &salt);
        let encrypted = encrypt_text("secret", &key1).unwrap();
        assert!(decrypt_text(&encrypted, &key2).is_err());
    }

    #[test]
    fn hex_roundtrip() {
        let data = [0xDE, 0xAD, 0xBE, 0xEF];
        let hex = hex_encode(&data);
        assert_eq!(hex, "deadbeef");
        let decoded = hex_decode(&hex).unwrap();
        assert_eq!(decoded, data);
    }
}
