use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::models::clipboard_entry::{ClipboardEntry, ClipboardHistoryPage};
use crate::services::crypto_service;

const MAX_TEXT_BYTES: usize = 100 * 1024;

#[derive(Debug, Clone)]
pub struct ClipboardHistoryStore {
    db_path: PathBuf,
    pub(crate) encryption_key: Arc<Mutex<Option<[u8; 32]>>>,
}

impl ClipboardHistoryStore {
    pub fn new(db_path: PathBuf, encryption_key: Arc<Mutex<Option<[u8; 32]>>>) -> Self {
        Self {
            db_path,
            encryption_key,
        }
    }

    pub fn initialize(&self) -> Result<(), String> {
        let connection = self.connect()?;
        ensure_schema(&connection).map_err(|error| error.to_string())
    }

    pub fn has_encryption_key(&self) -> bool {
        self.encryption_key
            .lock()
            .ok()
            .map(|k| k.is_some())
            .unwrap_or(false)
    }

    pub fn save_text(
        &self,
        text: &str,
        source_app: Option<&str>,
        max_history_items: usize,
    ) -> Result<(), String> {
        let truncated_text = truncate_text(text, MAX_TEXT_BYTES);
        if truncated_text.trim().is_empty() {
            return Ok(());
        }

        let copied_at = Local::now().to_rfc3339();
        let text_hash = hash_text(&truncated_text);
        let char_count = truncated_text.chars().count();

        let key = self
            .encryption_key
            .lock()
            .map_err(|e| e.to_string())?;

        let (stored_text, encrypted) = if let Some(ref k) = *key {
            (crypto_service::encrypt_text(&truncated_text, k)?, 1i64)
        } else {
            (truncated_text, 0i64)
        };

        drop(key);

        let connection = self.connect()?;
        connection
            .execute(
                "INSERT INTO clipboard_entries (text, text_hash, copied_at, source_app, is_pinned, char_count, encrypted, content_type)
                 VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, 'text')
                 ON CONFLICT(text_hash) DO UPDATE SET
                   text = excluded.text,
                   copied_at = excluded.copied_at,
                   source_app = excluded.source_app,
                   char_count = excluded.char_count,
                   encrypted = excluded.encrypted",
                params![stored_text, text_hash, copied_at, source_app, char_count as i64, encrypted],
            )
            .map_err(|error| error.to_string())?;

        self.trim_to_limit(max_history_items)
    }

    /// Save an image entry. `png_base64` is the base64-encoded PNG data.
    pub fn save_image(
        &self,
        png_base64: &str,
        image_hash: &str,
        max_history_items: usize,
    ) -> Result<(), String> {
        let copied_at = Local::now().to_rfc3339();
        let display_text = "[画像]".to_string();

        let connection = self.connect()?;
        connection
            .execute(
                "INSERT INTO clipboard_entries (text, text_hash, copied_at, source_app, is_pinned, char_count, encrypted, content_type, image_data)
                 VALUES (?1, ?2, ?3, NULL, 0, 0, 0, 'image', ?4)
                 ON CONFLICT(text_hash) DO UPDATE SET
                   copied_at = excluded.copied_at,
                   image_data = excluded.image_data",
                params![display_text, image_hash, copied_at, png_base64],
            )
            .map_err(|error| error.to_string())?;

        self.trim_to_limit(max_history_items)
    }

    pub fn list_history(
        &self,
        page: usize,
        page_size: usize,
        search: Option<&str>,
    ) -> Result<ClipboardHistoryPage, String> {
        let page = page.max(1);
        let page_size = page_size.max(1);
        let connection = self.connect()?;

        let has_encrypted: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM clipboard_entries WHERE encrypted = 1)",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if has_encrypted {
            self.list_history_with_decryption(&connection, page, page_size, search)
        } else {
            self.list_history_plain(&connection, page, page_size, search)
        }
    }

    fn list_history_with_decryption(
        &self,
        connection: &Connection,
        page: usize,
        page_size: usize,
        search: Option<&str>,
    ) -> Result<ClipboardHistoryPage, String> {
        let key = self.encryption_key.lock().map_err(|e| e.to_string())?;

        let mut stmt = connection
            .prepare(
                "SELECT id, text, copied_at, source_app, is_pinned, char_count, encrypted, content_type, image_data
                 FROM clipboard_entries
                 ORDER BY is_pinned DESC, copied_at DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], map_entry_row_with_encrypted)
            .map_err(|e| e.to_string())?;

        let all_raw: Vec<(ClipboardEntry, bool)> = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut entries: Vec<ClipboardEntry> = all_raw
            .into_iter()
            .map(|(mut entry, is_encrypted)| {
                if is_encrypted {
                    if let Some(ref k) = *key {
                        entry.text = crypto_service::decrypt_text(&entry.text, k)
                            .unwrap_or_else(|_| "[復号失敗]".to_string());
                    } else {
                        entry.text = "[ロック中]".to_string();
                    }
                }
                entry
            })
            .collect();

        if let Some(search) = search.filter(|s| !s.trim().is_empty()) {
            let lower = search.to_lowercase();
            entries.retain(|e| e.text.to_lowercase().contains(&lower));
        }

        let total = entries.len();
        let offset = (page - 1) * page_size;
        let page_entries: Vec<ClipboardEntry> =
            entries.into_iter().skip(offset).take(page_size).collect();

        Ok(ClipboardHistoryPage {
            entries: page_entries,
            total,
            page,
            page_size,
        })
    }

    fn list_history_plain(
        &self,
        connection: &Connection,
        page: usize,
        page_size: usize,
        search: Option<&str>,
    ) -> Result<ClipboardHistoryPage, String> {
        let offset = ((page - 1) * page_size) as i64;

        let total = if let Some(search) = search.filter(|v| !v.trim().is_empty()) {
            connection
                .query_row(
                    "SELECT COUNT(*) FROM clipboard_entries WHERE text LIKE ?1",
                    params![format!("%{search}%")],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| e.to_string())? as usize
        } else {
            connection
                .query_row(
                    "SELECT COUNT(*) FROM clipboard_entries",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| e.to_string())? as usize
        };

        let query = if search.filter(|v| !v.trim().is_empty()).is_some() {
            "SELECT id, text, copied_at, source_app, is_pinned, char_count, content_type, image_data
             FROM clipboard_entries
             WHERE text LIKE ?1
             ORDER BY is_pinned DESC, copied_at DESC
             LIMIT ?2 OFFSET ?3"
        } else {
            "SELECT id, text, copied_at, source_app, is_pinned, char_count, content_type, image_data
             FROM clipboard_entries
             ORDER BY is_pinned DESC, copied_at DESC
             LIMIT ?1 OFFSET ?2"
        };

        let mut statement = connection.prepare(query).map_err(|e| e.to_string())?;
        let rows = if let Some(search) = search.filter(|v| !v.trim().is_empty()) {
            statement
                .query_map(
                    params![format!("%{search}%"), page_size as i64, offset],
                    map_entry_row,
                )
                .map_err(|e| e.to_string())?
        } else {
            statement
                .query_map(params![page_size as i64, offset], map_entry_row)
                .map_err(|e| e.to_string())?
        };

        let entries = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(ClipboardHistoryPage {
            entries,
            total,
            page,
            page_size,
        })
    }

    pub fn get_entry(&self, id: i64) -> Result<Option<ClipboardEntry>, String> {
        let connection = self.connect()?;
        let result = connection
            .query_row(
                "SELECT id, text, copied_at, source_app, is_pinned, char_count, encrypted, content_type, image_data
                 FROM clipboard_entries WHERE id = ?1",
                params![id],
                map_entry_row_with_encrypted,
            )
            .optional()
            .map_err(|e| e.to_string())?;

        if let Some((mut entry, is_encrypted)) = result {
            if is_encrypted {
                let key = self.encryption_key.lock().map_err(|e| e.to_string())?;
                if let Some(ref k) = *key {
                    entry.text = crypto_service::decrypt_text(&entry.text, k)?;
                } else {
                    return Err("アプリがロックされています。".to_string());
                }
            }
            Ok(Some(entry))
        } else {
            Ok(None)
        }
    }

    pub fn set_pinned(&self, id: i64, pinned: bool) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute(
                "UPDATE clipboard_entries SET is_pinned = ?2 WHERE id = ?1",
                params![id, if pinned { 1 } else { 0 }],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn update_entry_text(&self, id: i64, text: &str) -> Result<(), String> {
        let truncated = truncate_text(text, MAX_TEXT_BYTES);
        let text_hash = hash_text(&truncated);
        let char_count = truncated.chars().count() as i64;

        let key = self.encryption_key.lock().map_err(|e| e.to_string())?;
        let (stored_text, encrypted) = if let Some(ref k) = *key {
            (crypto_service::encrypt_text(&truncated, k)?, 1i64)
        } else {
            (truncated, 0i64)
        };
        drop(key);

        let connection = self.connect()?;
        connection
            .execute(
                "UPDATE clipboard_entries SET text = ?2, text_hash = ?3, char_count = ?4, encrypted = ?5 WHERE id = ?1",
                params![id, stored_text, text_hash, char_count, encrypted],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn delete_entry(&self, id: i64) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM clipboard_entries WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn encrypt_all_entries(&self, key: &[u8; 32]) -> Result<(), String> {
        let connection = self.connect()?;
        let mut stmt = connection
            .prepare("SELECT id, text FROM clipboard_entries WHERE encrypted = 0 AND content_type = 'text'")
            .map_err(|e| e.to_string())?;

        let entries: Vec<(i64, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for (id, text) in entries {
            let encrypted_text = crypto_service::encrypt_text(&text, key)?;
            connection
                .execute(
                    "UPDATE clipboard_entries SET text = ?2, encrypted = 1 WHERE id = ?1",
                    params![id, encrypted_text],
                )
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn decrypt_all_entries(&self, key: &[u8; 32]) -> Result<(), String> {
        let connection = self.connect()?;
        let mut stmt = connection
            .prepare("SELECT id, text FROM clipboard_entries WHERE encrypted = 1")
            .map_err(|e| e.to_string())?;

        let entries: Vec<(i64, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for (id, text) in entries {
            let decrypted_text = crypto_service::decrypt_text(&text, key)?;
            connection
                .execute(
                    "UPDATE clipboard_entries SET text = ?2, encrypted = 0 WHERE id = ?1",
                    params![id, decrypted_text],
                )
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    fn trim_to_limit(&self, max_history_items: usize) -> Result<(), String> {
        let connection = self.connect()?;
        let total = connection
            .query_row("SELECT COUNT(*) FROM clipboard_entries", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|error| error.to_string())? as usize;

        if total <= max_history_items {
            return Ok(());
        }

        let delete_count = (total - max_history_items) as i64;
        connection
            .execute(
                "DELETE FROM clipboard_entries
                 WHERE id IN (
                   SELECT id FROM clipboard_entries
                   WHERE is_pinned = 0
                   ORDER BY copied_at ASC
                   LIMIT ?1
                 )",
                params![delete_count],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn connect(&self) -> Result<Connection, String> {
        ensure_parent_dir(&self.db_path)?;
        let connection = Connection::open(&self.db_path).map_err(|error| error.to_string())?;
        ensure_schema(&connection).map_err(|error| error.to_string())?;
        Ok(connection)
    }
}

pub(crate) fn ensure_schema(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS clipboard_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            text_hash TEXT NOT NULL,
            copied_at TEXT NOT NULL,
            source_app TEXT,
            is_pinned INTEGER DEFAULT 0,
            char_count INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_text_hash ON clipboard_entries(text_hash);
        CREATE INDEX IF NOT EXISTS idx_copied_at ON clipboard_entries(copied_at DESC);
        CREATE TABLE IF NOT EXISTS template_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            encrypted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            encrypted INTEGER DEFAULT 0,
            FOREIGN KEY (group_id) REFERENCES template_groups(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_templates_group ON templates(group_id, sort_order);",
    )?;

    // Migration: add encrypted column
    let has_clipboard_encrypted_col = connection
        .prepare("SELECT encrypted FROM clipboard_entries LIMIT 0")
        .is_ok();

    if !has_clipboard_encrypted_col {
        connection
            .execute_batch("ALTER TABLE clipboard_entries ADD COLUMN encrypted INTEGER DEFAULT 0")?;
    }

    // Migration: add content_type column
    let has_content_type_col = connection
        .prepare("SELECT content_type FROM clipboard_entries LIMIT 0")
        .is_ok();

    if !has_content_type_col {
        connection.execute_batch(
            "ALTER TABLE clipboard_entries ADD COLUMN content_type TEXT DEFAULT 'text'"
        )?;
    }

    // Migration: add image_data column
    let has_image_data_col = connection
        .prepare("SELECT image_data FROM clipboard_entries LIMIT 0")
        .is_ok();

    if !has_image_data_col {
        connection.execute_batch(
            "ALTER TABLE clipboard_entries ADD COLUMN image_data TEXT"
        )?;
    }

    let has_template_group_encrypted_col = connection
        .prepare("SELECT encrypted FROM template_groups LIMIT 0")
        .is_ok();

    if !has_template_group_encrypted_col {
        connection
            .execute_batch("ALTER TABLE template_groups ADD COLUMN encrypted INTEGER DEFAULT 0")?;
    }

    let has_template_encrypted_col = connection
        .prepare("SELECT encrypted FROM templates LIMIT 0")
        .is_ok();

    if !has_template_encrypted_col {
        connection.execute_batch("ALTER TABLE templates ADD COLUMN encrypted INTEGER DEFAULT 0")?;
    }

    Ok(())
}

fn truncate_text(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }

    let mut end = max_bytes;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_string()
}

fn hash_text(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    format!("{digest:x}")
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn map_entry_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClipboardEntry> {
    Ok(ClipboardEntry {
        id: row.get(0)?,
        text: row.get(1)?,
        copied_at: row.get(2)?,
        source_app: row.get(3)?,
        is_pinned: row.get::<_, i64>(4)? != 0,
        char_count: row.get::<_, i64>(5)? as usize,
        content_type: row.get::<_, String>(6).unwrap_or_else(|_| "text".to_string()),
        image_data: row.get::<_, Option<String>>(7).unwrap_or(None),
    })
}

fn map_entry_row_with_encrypted(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<(ClipboardEntry, bool)> {
    Ok((
        ClipboardEntry {
            id: row.get(0)?,
            text: row.get(1)?,
            copied_at: row.get(2)?,
            source_app: row.get(3)?,
            is_pinned: row.get::<_, i64>(4)? != 0,
            char_count: row.get::<_, i64>(5)? as usize,
            content_type: row.get::<_, String>(7).unwrap_or_else(|_| "text".to_string()),
            image_data: row.get::<_, Option<String>>(8).unwrap_or(None),
        },
        row.get::<_, i64>(6).unwrap_or(0) != 0,
    ))
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use tempfile::tempdir;

    use super::ClipboardHistoryStore;

    fn make_store(dir: &std::path::Path) -> ClipboardHistoryStore {
        ClipboardHistoryStore::new(
            dir.join("history.db"),
            Arc::new(Mutex::new(None)),
        )
    }

    #[test]
    fn deduplicates_by_hash_and_keeps_single_row() {
        let temp = tempdir().unwrap();
        let store = make_store(temp.path());

        store.save_text("alpha", None, 100).unwrap();
        store.save_text("alpha", None, 100).unwrap();

        let page = store.list_history(1, 10, None).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.entries[0].text, "alpha");
        assert_eq!(page.entries[0].content_type, "text");
    }

    #[test]
    fn trims_oldest_unpinned_rows() {
        let temp = tempdir().unwrap();
        let store = make_store(temp.path());

        store.save_text("one", None, 10).unwrap();
        store.save_text("two", None, 10).unwrap();
        store.save_text("three", None, 10).unwrap();
        let page = store.list_history(1, 10, None).unwrap();
        let oldest_id = page.entries.last().unwrap().id;
        store.set_pinned(oldest_id, true).unwrap();

        store.save_text("four", None, 3).unwrap();

        let page = store.list_history(1, 10, None).unwrap();
        assert_eq!(page.total, 3);
        assert!(page.entries.iter().any(|entry| entry.id == oldest_id));
    }

    #[test]
    fn encryption_roundtrip() {
        let temp = tempdir().unwrap();
        let key: [u8; 32] = [42u8; 32];
        let store = ClipboardHistoryStore::new(
            temp.path().join("history.db"),
            Arc::new(Mutex::new(Some(key))),
        );

        store.save_text("secret data", None, 100).unwrap();

        let page = store.list_history(1, 10, None).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.entries[0].text, "secret data");

        let entry = store.get_entry(page.entries[0].id).unwrap().unwrap();
        assert_eq!(entry.text, "secret data");
    }

    #[test]
    fn save_and_retrieve_image() {
        let temp = tempdir().unwrap();
        let store = make_store(temp.path());

        store.save_image("iVBORw0KGgo=", "abc123hash", 100).unwrap();

        let page = store.list_history(1, 10, None).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.entries[0].content_type, "image");
        assert_eq!(page.entries[0].image_data.as_deref(), Some("iVBORw0KGgo="));
    }
}
