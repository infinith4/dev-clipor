use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::template::{TemplateEntry, TemplateExportPayload, TemplateGroup};
use crate::services::clipboard_history_store::ensure_schema;
use crate::services::crypto_service;

#[derive(Debug, Clone)]
pub struct TemplateStore {
    db_path: PathBuf,
    encryption_key: Arc<Mutex<Option<[u8; 32]>>>,
}

#[derive(Debug, Clone)]
pub struct UpsertTemplateInput {
    pub id: Option<i64>,
    pub title: String,
    pub text: String,
    pub content_type: Option<String>,
    pub image_data: Option<String>,
    pub group_id: Option<i64>,
    pub new_group_name: Option<String>,
}

impl TemplateStore {
    pub fn new(db_path: PathBuf, encryption_key: Arc<Mutex<Option<[u8; 32]>>>) -> Self {
        Self {
            db_path,
            encryption_key,
        }
    }

    pub fn list_groups(&self) -> Result<Vec<TemplateGroup>, String> {
        let connection = self.connect()?;
        let key = self.current_key()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, sort_order, created_at, encrypted
                 FROM template_groups
                 ORDER BY sort_order ASC, created_at ASC, id ASC",
            )
            .map_err(|error| error.to_string())?;

        let rows = statement
            .query_map([], map_group_row_with_encrypted)
            .map_err(|error| error.to_string())?;

        let mut groups = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
            .into_iter()
            .map(|(mut group, encrypted)| {
                if encrypted {
                    group.name = decrypt_or_placeholder(&group.name, key.as_ref());
                }
                group
            })
            .collect::<Vec<_>>();

        groups.sort_by(|left, right| {
            left.sort_order
                .cmp(&right.sort_order)
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        });

        Ok(groups)
    }

    pub fn list_templates(
        &self,
        search: Option<&str>,
        group_id: Option<i64>,
    ) -> Result<Vec<TemplateEntry>, String> {
        let connection = self.connect()?;
        let key = self.current_key()?;
        let mut statement = connection
            .prepare(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at, g.encrypted, t.encrypted, t.content_type, t.image_data
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 ORDER BY g.sort_order ASC, t.sort_order ASC, t.updated_at DESC, t.id DESC",
            )
            .map_err(|error| error.to_string())?;

        let rows = statement
            .query_map([], map_template_row_with_encrypted)
            .map_err(|error| error.to_string())?;

        let normalized_search = search
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.to_lowercase());

        let templates = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
            .into_iter()
            .filter_map(|(mut template, group_encrypted, template_encrypted)| {
                if let Some(group_id) = group_id {
                    if template.group_id != group_id {
                        return None;
                    }
                }

                if group_encrypted {
                    template.group_name = decrypt_or_placeholder(&template.group_name, key.as_ref());
                }

                if template_encrypted {
                    template.title = decrypt_or_placeholder(&template.title, key.as_ref());
                    template.text = decrypt_or_placeholder(&template.text, key.as_ref());
                }

                if let Some(search) = normalized_search.as_ref() {
                    let haystack = format!(
                        "{}\n{}\n{}",
                        template.title.to_lowercase(),
                        template.text.to_lowercase(),
                        template.group_name.to_lowercase()
                    );

                    if !haystack.contains(search) {
                        return None;
                    }
                }

                Some(template)
            })
            .collect();

        Ok(templates)
    }

    pub fn upsert_template(&self, input: UpsertTemplateInput) -> Result<(), String> {
        let mut connection = self.connect()?;
        let write_key = self.resolve_write_encryption(&connection)?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        let group_id = if let Some(group_id) = input.group_id {
            group_id
        } else if let Some(group_name) = input.new_group_name.filter(|value| !value.trim().is_empty()) {
            self.upsert_group_internal(&transaction, &group_name, write_key.as_ref())?
        } else {
            return Err("テンプレートのグループを指定してください。".into());
        };

        let now = Local::now().to_rfc3339();
        let encrypted = if write_key.is_some() { 1 } else { 0 };
        let stored_title = if let Some(key) = write_key.as_ref() {
            crypto_service::encrypt_text(&input.title, key)?
        } else {
            input.title.clone()
        };
        let stored_text = if let Some(key) = write_key.as_ref() {
            crypto_service::encrypt_text(&input.text, key)?
        } else {
            input.text.clone()
        };

        let content_type = input.content_type.as_deref().unwrap_or("text");
        let image_data = input.image_data.as_deref();

        if let Some(id) = input.id {
            transaction
                .execute(
                    "UPDATE templates
                     SET group_id = ?2, title = ?3, text = ?4, updated_at = ?5, encrypted = ?6, content_type = ?7, image_data = ?8
                     WHERE id = ?1",
                    params![id, group_id, stored_title, stored_text, now, encrypted, content_type, image_data],
                )
                .map_err(|error| error.to_string())?;
        } else {
            transaction
                .execute(
                    "INSERT INTO templates (group_id, title, text, sort_order, created_at, updated_at, encrypted, content_type, image_data)
                     VALUES (?1, ?2, ?3, 0, ?4, ?4, ?5, ?6, ?7)",
                    params![group_id, stored_title, stored_text, now, encrypted, content_type, image_data],
                )
                .map_err(|error| error.to_string())?;
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn delete_template(&self, id: i64) -> Result<(), String> {
        let connection = self.connect()?;
        let _ = self.resolve_write_encryption(&connection)?;
        connection
            .execute("DELETE FROM templates WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn get_template(&self, id: i64) -> Result<Option<TemplateEntry>, String> {
        let connection = self.connect()?;
        let key = self.current_key()?;
        connection
            .query_row(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at, g.encrypted, t.encrypted, t.content_type, t.image_data
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 WHERE t.id = ?1",
                params![id],
                map_template_row_with_encrypted,
            )
            .optional()
            .map_err(|error| error.to_string())
            .and_then(|value| {
                value.map(|(mut template, group_encrypted, template_encrypted)| {
                    if group_encrypted {
                        template.group_name =
                            decrypt_or_fail(&template.group_name, key.as_ref())?;
                    }

                    if template_encrypted {
                        template.title = decrypt_or_fail(&template.title, key.as_ref())?;
                        template.text = decrypt_or_fail(&template.text, key.as_ref())?;
                    }

                    Ok(template)
                })
                .transpose()
            })
    }

    pub fn export_templates(&self) -> Result<TemplateExportPayload, String> {
        let connection = self.connect()?;
        if has_encrypted_template_data(&connection)? && self.current_key()?.is_none() {
            return Err("アプリがロックされています。".to_string());
        }

        Ok(TemplateExportPayload {
            groups: self.list_groups()?,
            templates: self.list_templates(None, None)?,
        })
    }

    pub fn import_templates(&self, json: &str) -> Result<(), String> {
        let payload: TemplateExportPayload =
            serde_json::from_str(json).map_err(|error| error.to_string())?;
        let mut connection = self.connect()?;
        let write_key = self.resolve_write_encryption(&connection)?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;

        transaction
            .execute("DELETE FROM templates", [])
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM template_groups", [])
            .map_err(|error| error.to_string())?;

        for group in payload.groups {
            let encrypted = if let Some(key) = write_key.as_ref() {
                let encrypted_name = crypto_service::encrypt_text(&group.name, key)?;
                transaction
                    .execute(
                        "INSERT INTO template_groups (id, name, sort_order, created_at, encrypted)
                         VALUES (?1, ?2, ?3, ?4, 1)",
                        params![group.id, encrypted_name, group.sort_order, group.created_at],
                    )
                    .map_err(|error| error.to_string())?;
                continue;
            } else {
                0
            };

            transaction
                .execute(
                    "INSERT INTO template_groups (id, name, sort_order, created_at, encrypted)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![group.id, group.name, group.sort_order, group.created_at, encrypted],
                )
                .map_err(|error| error.to_string())?;
        }

        for template in payload.templates {
            let content_type = &template.content_type;
            let image_data = template.image_data.as_deref();

            let encrypted = if let Some(key) = write_key.as_ref() {
                let encrypted_title = crypto_service::encrypt_text(&template.title, key)?;
                let encrypted_text = crypto_service::encrypt_text(&template.text, key)?;
                transaction
                    .execute(
                        "INSERT INTO templates (id, group_id, title, text, sort_order, created_at, updated_at, encrypted, content_type, image_data)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)",
                        params![
                            template.id,
                            template.group_id,
                            encrypted_title,
                            encrypted_text,
                            template.sort_order,
                            template.created_at,
                            template.updated_at,
                            content_type,
                            image_data
                        ],
                    )
                    .map_err(|error| error.to_string())?;
                continue;
            } else {
                0
            };

            transaction
                .execute(
                    "INSERT INTO templates (id, group_id, title, text, sort_order, created_at, updated_at, encrypted, content_type, image_data)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        template.id,
                        template.group_id,
                        template.title,
                        template.text,
                        template.sort_order,
                        template.created_at,
                        template.updated_at,
                        encrypted,
                        content_type,
                        image_data
                    ],
                )
                .map_err(|error| error.to_string())?;
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn render_placeholders(&self, text: &str, clipboard_text: &str) -> String {
        let now = Local::now();
        text.replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M:%S").to_string())
            .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
            .replace("{{time}}", &now.format("%H:%M:%S").to_string())
            .replace("{{clipboard}}", clipboard_text)
    }

    fn connect(&self) -> Result<Connection, String> {
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let connection = Connection::open(&self.db_path).map_err(|error| error.to_string())?;
        ensure_schema(&connection).map_err(|error| error.to_string())?;
        Ok(connection)
    }

    pub fn encrypt_all_entries(&self, key: &[u8; 32]) -> Result<(), String> {
        let connection = self.connect()?;

        let mut group_statement = connection
            .prepare("SELECT id, name FROM template_groups WHERE encrypted = 0")
            .map_err(|error| error.to_string())?;
        let groups = group_statement
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (id, name) in groups {
            let encrypted_name = crypto_service::encrypt_text(&name, key)?;
            connection
                .execute(
                    "UPDATE template_groups SET name = ?2, encrypted = 1 WHERE id = ?1",
                    params![id, encrypted_name],
                )
                .map_err(|error| error.to_string())?;
        }

        let mut template_statement = connection
            .prepare("SELECT id, title, text FROM templates WHERE encrypted = 0")
            .map_err(|error| error.to_string())?;
        let templates = template_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (id, title, text) in templates {
            let encrypted_title = crypto_service::encrypt_text(&title, key)?;
            let encrypted_text = crypto_service::encrypt_text(&text, key)?;
            connection
                .execute(
                    "UPDATE templates SET title = ?2, text = ?3, encrypted = 1 WHERE id = ?1",
                    params![id, encrypted_title, encrypted_text],
                )
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    pub fn decrypt_all_entries(&self, key: &[u8; 32]) -> Result<(), String> {
        let connection = self.connect()?;

        let mut group_statement = connection
            .prepare("SELECT id, name FROM template_groups WHERE encrypted = 1")
            .map_err(|error| error.to_string())?;
        let groups = group_statement
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (id, name) in groups {
            let decrypted_name = crypto_service::decrypt_text(&name, key)?;
            connection
                .execute(
                    "UPDATE template_groups SET name = ?2, encrypted = 0 WHERE id = ?1",
                    params![id, decrypted_name],
                )
                .map_err(|error| error.to_string())?;
        }

        let mut template_statement = connection
            .prepare("SELECT id, title, text FROM templates WHERE encrypted = 1")
            .map_err(|error| error.to_string())?;
        let templates = template_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (id, title, text) in templates {
            let decrypted_title = crypto_service::decrypt_text(&title, key)?;
            let decrypted_text = crypto_service::decrypt_text(&text, key)?;
            connection
                .execute(
                    "UPDATE templates SET title = ?2, text = ?3, encrypted = 0 WHERE id = ?1",
                    params![id, decrypted_title, decrypted_text],
                )
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    fn upsert_group_internal(
        &self,
        transaction: &rusqlite::Transaction<'_>,
        group_name: &str,
        key: Option<&[u8; 32]>,
    ) -> Result<i64, String> {
        let mut statement = transaction
            .prepare(
                "SELECT id, name, sort_order, created_at, encrypted
                 FROM template_groups",
            )
            .map_err(|error| error.to_string())?;
        let groups = statement
            .query_map([], map_group_row_with_encrypted)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (group, encrypted) in groups {
            let existing_name = if encrypted {
                decrypt_or_fail(&group.name, key)?
            } else {
                group.name
            };

            if existing_name == group_name {
                return Ok(group.id);
            }
        }

        let created_at = Local::now().to_rfc3339();
        let encrypted = if let Some(key) = key {
            let encrypted_name = crypto_service::encrypt_text(group_name, key)?;
            transaction
                .execute(
                    "INSERT INTO template_groups (name, sort_order, created_at, encrypted)
                     VALUES (?1, 0, ?2, 1)",
                    params![encrypted_name, created_at],
                )
                .map_err(|error| error.to_string())?;
            return Ok(transaction.last_insert_rowid());
        } else {
            0
        };

        transaction
            .execute(
                "INSERT INTO template_groups (name, sort_order, created_at, encrypted)
                 VALUES (?1, 0, ?2, ?3)",
                params![group_name, created_at, encrypted],
            )
            .map_err(|error| error.to_string())?;

        Ok(transaction.last_insert_rowid())
    }

    fn current_key(&self) -> Result<Option<[u8; 32]>, String> {
        let key = self.encryption_key.lock().map_err(|error| error.to_string())?;
        Ok(*key)
    }

    fn resolve_write_encryption(&self, connection: &Connection) -> Result<Option<[u8; 32]>, String> {
        let key = self.current_key()?;
        if has_encrypted_template_data(connection)? && key.is_none() {
            return Err("アプリがロックされています。".to_string());
        }

        Ok(key)
    }
}

fn map_group_row_with_encrypted(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<(TemplateGroup, bool)> {
    Ok((
        TemplateGroup {
            id: row.get(0)?,
            name: row.get(1)?,
            sort_order: row.get(2)?,
            created_at: row.get(3)?,
        },
        row.get::<_, i64>(4).unwrap_or(0) != 0,
    ))
}

fn map_template_row_with_encrypted(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<(TemplateEntry, bool, bool)> {
    Ok((
        TemplateEntry {
        id: row.get(0)?,
        group_id: row.get(1)?,
        group_name: row.get(2)?,
        title: row.get(3)?,
        text: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        content_type: row.get::<_, String>(10).unwrap_or_else(|_| "text".to_string()),
        image_data: row.get::<_, Option<String>>(11).unwrap_or(None),
        },
        row.get::<_, i64>(8).unwrap_or(0) != 0,
        row.get::<_, i64>(9).unwrap_or(0) != 0,
    ))
}

fn has_encrypted_template_data(connection: &Connection) -> Result<bool, String> {
    let groups_encrypted = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM template_groups WHERE encrypted = 1)",
            [],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|error| error.to_string())?;

    if groups_encrypted {
        return Ok(true);
    }

    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM templates WHERE encrypted = 1)",
            [],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|error| error.to_string())
}

fn decrypt_or_placeholder(value: &str, key: Option<&[u8; 32]>) -> String {
    match key {
        Some(key) => crypto_service::decrypt_text(value, key)
            .unwrap_or_else(|_| "[復号失敗]".to_string()),
        None => "[ロック中]".to_string(),
    }
}

fn decrypt_or_fail(value: &str, key: Option<&[u8; 32]>) -> Result<String, String> {
    let key = key.ok_or_else(|| "アプリがロックされています。".to_string())?;
    crypto_service::decrypt_text(value, key)
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use tempfile::tempdir;

    use super::{TemplateStore, UpsertTemplateInput};

    #[test]
    fn replaces_template_placeholders() {
        let temp = tempdir().unwrap();
        let store = TemplateStore::new(temp.path().join("history.db"), Arc::new(Mutex::new(None)));
        let rendered = store.render_placeholders("Today {{date}} {{clipboard}}", "sample");

        assert!(rendered.contains("sample"));
        assert!(rendered.contains("Today"));
    }

    #[test]
    fn can_save_and_list_templates() {
        let temp = tempdir().unwrap();
        let store = TemplateStore::new(temp.path().join("history.db"), Arc::new(Mutex::new(None)));

        store
            .upsert_template(UpsertTemplateInput {
                id: None,
                title: "Greeting".into(),
                text: "Hello".into(),
                content_type: None,
                image_data: None,
                group_id: None,
                new_group_name: Some("General".into()),
            })
            .unwrap();

        let templates = store.list_templates(None, None).unwrap();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].group_name, "General");
    }

    #[test]
    fn encrypted_templates_roundtrip() {
        let temp = tempdir().unwrap();
        let key = [7u8; 32];
        let store = TemplateStore::new(
            temp.path().join("history.db"),
            Arc::new(Mutex::new(Some(key))),
        );

        store
            .upsert_template(UpsertTemplateInput {
                id: None,
                title: "Greeting".into(),
                text: "Hello secret".into(),
                content_type: None,
                image_data: None,
                group_id: None,
                new_group_name: Some("General".into()),
            })
            .unwrap();

        let templates = store.list_templates(None, None).unwrap();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].title, "Greeting");
        assert_eq!(templates[0].text, "Hello secret");
        assert_eq!(templates[0].group_name, "General");
    }
}
