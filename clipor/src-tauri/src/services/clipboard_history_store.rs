use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::models::clipboard_entry::{ClipboardEntry, ClipboardHistoryPage};

const MAX_TEXT_BYTES: usize = 100 * 1024;

#[derive(Debug, Clone)]
pub struct ClipboardHistoryStore {
    db_path: PathBuf,
}

impl ClipboardHistoryStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn initialize(&self) -> Result<(), String> {
        let connection = self.connect()?;
        ensure_schema(&connection).map_err(|error| error.to_string())
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
        let connection = self.connect()?;

        connection
            .execute(
                "INSERT INTO clipboard_entries (text, text_hash, copied_at, source_app, is_pinned, char_count)
                 VALUES (?1, ?2, ?3, ?4, 0, ?5)
                 ON CONFLICT(text_hash) DO UPDATE SET
                   copied_at = excluded.copied_at,
                   source_app = excluded.source_app,
                   char_count = excluded.char_count",
                params![truncated_text, text_hash, copied_at, source_app, char_count as i64],
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
        let offset = ((page - 1) * page_size) as i64;
        let connection = self.connect()?;

        let total = if let Some(search) = search.filter(|value| !value.trim().is_empty()) {
            connection
                .query_row(
                    "SELECT COUNT(*) FROM clipboard_entries WHERE text LIKE ?1",
                    params![format!("%{search}%")],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|error| error.to_string())? as usize
        } else {
            connection
                .query_row("SELECT COUNT(*) FROM clipboard_entries", [], |row| row.get::<_, i64>(0))
                .map_err(|error| error.to_string())? as usize
        };

        let query = if search.filter(|value| !value.trim().is_empty()).is_some() {
            "SELECT id, text, copied_at, source_app, is_pinned, char_count
             FROM clipboard_entries
             WHERE text LIKE ?1
             ORDER BY is_pinned DESC, copied_at DESC
             LIMIT ?2 OFFSET ?3"
        } else {
            "SELECT id, text, copied_at, source_app, is_pinned, char_count
             FROM clipboard_entries
             ORDER BY is_pinned DESC, copied_at DESC
             LIMIT ?1 OFFSET ?2"
        };

        let mut statement = connection.prepare(query).map_err(|error| error.to_string())?;
        let rows = if let Some(search) = search.filter(|value| !value.trim().is_empty()) {
            statement
                .query_map(
                    params![format!("%{search}%"), page_size as i64, offset],
                    map_entry_row,
                )
                .map_err(|error| error.to_string())?
        } else {
            statement
                .query_map(params![page_size as i64, offset], map_entry_row)
                .map_err(|error| error.to_string())?
        };

        let entries = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(ClipboardHistoryPage {
            entries,
            total,
            page,
            page_size,
        })
    }

    pub fn get_entry(&self, id: i64) -> Result<Option<ClipboardEntry>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "SELECT id, text, copied_at, source_app, is_pinned, char_count
                 FROM clipboard_entries WHERE id = ?1",
                params![id],
                map_entry_row,
            )
            .optional()
            .map_err(|error| error.to_string())
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
        let connection = self.connect()?;
        connection
            .execute(
                "UPDATE clipboard_entries SET text = ?2, text_hash = ?3, char_count = ?4 WHERE id = ?1",
                params![id, truncated, text_hash, char_count],
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

    fn trim_to_limit(&self, max_history_items: usize) -> Result<(), String> {
        let connection = self.connect()?;
        let total = connection
            .query_row("SELECT COUNT(*) FROM clipboard_entries", [], |row| row.get::<_, i64>(0))
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
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES template_groups(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_templates_group ON templates(group_id, sort_order);",
    )
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
    })
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::ClipboardHistoryStore;

    #[test]
    fn deduplicates_by_hash_and_keeps_single_row() {
        let temp = tempdir().unwrap();
        let store = ClipboardHistoryStore::new(temp.path().join("history.db"));

        store.save_text("alpha", None, 100).unwrap();
        store.save_text("alpha", None, 100).unwrap();

        let page = store.list_history(1, 10, None).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.entries[0].text, "alpha");
    }

    #[test]
    fn trims_oldest_unpinned_rows() {
        let temp = tempdir().unwrap();
        let store = ClipboardHistoryStore::new(temp.path().join("history.db"));

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
}
