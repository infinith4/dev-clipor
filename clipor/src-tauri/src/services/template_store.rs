use std::path::PathBuf;

use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::template::{TemplateEntry, TemplateExportPayload, TemplateGroup};
use crate::services::clipboard_history_store::ensure_schema;

#[derive(Debug, Clone)]
pub struct TemplateStore {
    db_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct UpsertTemplateInput {
    pub id: Option<i64>,
    pub title: String,
    pub text: String,
    pub group_id: Option<i64>,
    pub new_group_name: Option<String>,
}

impl TemplateStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn list_groups(&self) -> Result<Vec<TemplateGroup>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, sort_order, created_at
                 FROM template_groups
                 ORDER BY sort_order ASC, name ASC",
            )
            .map_err(|error| error.to_string())?;

        let rows = statement
            .query_map([], |row| {
                Ok(TemplateGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sort_order: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn list_templates(
        &self,
        search: Option<&str>,
        group_id: Option<i64>,
    ) -> Result<Vec<TemplateEntry>, String> {
        let connection = self.connect()?;
        let search = search.filter(|value| !value.trim().is_empty());
        let mut statement = match (search, group_id) {
            (Some(_), Some(_)) => connection.prepare(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 WHERE (t.title LIKE ?1 OR t.text LIKE ?1 OR g.name LIKE ?1) AND t.group_id = ?2
                 ORDER BY g.sort_order ASC, t.sort_order ASC, t.updated_at DESC",
            ),
            (Some(_), None) => connection.prepare(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 WHERE t.title LIKE ?1 OR t.text LIKE ?1 OR g.name LIKE ?1
                 ORDER BY g.sort_order ASC, t.sort_order ASC, t.updated_at DESC",
            ),
            (None, Some(_)) => connection.prepare(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 WHERE t.group_id = ?1
                 ORDER BY g.sort_order ASC, t.sort_order ASC, t.updated_at DESC",
            ),
            (None, None) => connection.prepare(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 ORDER BY g.sort_order ASC, t.sort_order ASC, t.updated_at DESC",
            ),
        }
        .map_err(|error| error.to_string())?;

        let rows = match (search, group_id) {
            (Some(search), Some(group_id)) => {
                statement.query_map(params![format!("%{search}%"), group_id], map_template_row)
            }
            (Some(search), None) => {
                statement.query_map(params![format!("%{search}%")], map_template_row)
            }
            (None, Some(group_id)) => statement.query_map(params![group_id], map_template_row),
            (None, None) => statement.query_map([], map_template_row),
        }
        .map_err(|error| error.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn upsert_template(&self, input: UpsertTemplateInput) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        let group_id = if let Some(group_id) = input.group_id {
            group_id
        } else if let Some(group_name) = input.new_group_name.filter(|value| !value.trim().is_empty()) {
            self.upsert_group_internal(&transaction, &group_name)?
        } else {
            return Err("テンプレートのグループを指定してください。".into());
        };

        let now = Local::now().to_rfc3339();
        if let Some(id) = input.id {
            transaction
                .execute(
                    "UPDATE templates
                     SET group_id = ?2, title = ?3, text = ?4, updated_at = ?5
                     WHERE id = ?1",
                    params![id, group_id, input.title, input.text, now],
                )
                .map_err(|error| error.to_string())?;
        } else {
            transaction
                .execute(
                    "INSERT INTO templates (group_id, title, text, sort_order, created_at, updated_at)
                     VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                    params![group_id, input.title, input.text, now],
                )
                .map_err(|error| error.to_string())?;
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn delete_template(&self, id: i64) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute("DELETE FROM templates WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn get_template(&self, id: i64) -> Result<Option<TemplateEntry>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "SELECT t.id, t.group_id, g.name, t.title, t.text, t.sort_order, t.created_at, t.updated_at
                 FROM templates t
                 JOIN template_groups g ON g.id = t.group_id
                 WHERE t.id = ?1",
                params![id],
                map_template_row,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    pub fn export_templates(&self) -> Result<TemplateExportPayload, String> {
        Ok(TemplateExportPayload {
            groups: self.list_groups()?,
            templates: self.list_templates(None, None)?,
        })
    }

    pub fn import_templates(&self, json: &str) -> Result<(), String> {
        let payload: TemplateExportPayload =
            serde_json::from_str(json).map_err(|error| error.to_string())?;
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|error| error.to_string())?;

        transaction
            .execute("DELETE FROM templates", [])
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM template_groups", [])
            .map_err(|error| error.to_string())?;

        for group in payload.groups {
            transaction
                .execute(
                    "INSERT INTO template_groups (id, name, sort_order, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![group.id, group.name, group.sort_order, group.created_at],
                )
                .map_err(|error| error.to_string())?;
        }

        for template in payload.templates {
            transaction
                .execute(
                    "INSERT INTO templates (id, group_id, title, text, sort_order, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        template.id,
                        template.group_id,
                        template.title,
                        template.text,
                        template.sort_order,
                        template.created_at,
                        template.updated_at
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

    fn upsert_group_internal(
        &self,
        transaction: &rusqlite::Transaction<'_>,
        group_name: &str,
    ) -> Result<i64, String> {
        let existing = transaction
            .query_row(
                "SELECT id FROM template_groups WHERE name = ?1",
                params![group_name],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        if let Some(id) = existing {
            return Ok(id);
        }

        let created_at = Local::now().to_rfc3339();
        transaction
            .execute(
                "INSERT INTO template_groups (name, sort_order, created_at)
                 VALUES (?1, 0, ?2)",
                params![group_name, created_at],
            )
            .map_err(|error| error.to_string())?;

        Ok(transaction.last_insert_rowid())
    }
}

fn map_template_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TemplateEntry> {
    Ok(TemplateEntry {
        id: row.get(0)?,
        group_id: row.get(1)?,
        group_name: row.get(2)?,
        title: row.get(3)?,
        text: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{TemplateStore, UpsertTemplateInput};

    #[test]
    fn replaces_template_placeholders() {
        let temp = tempdir().unwrap();
        let store = TemplateStore::new(temp.path().join("history.db"));
        let rendered = store.render_placeholders("Today {{date}} {{clipboard}}", "sample");

        assert!(rendered.contains("sample"));
        assert!(rendered.contains("Today"));
    }

    #[test]
    fn can_save_and_list_templates() {
        let temp = tempdir().unwrap();
        let store = TemplateStore::new(temp.path().join("history.db"));

        store
            .upsert_template(UpsertTemplateInput {
                id: None,
                title: "Greeting".into(),
                text: "Hello".into(),
                group_id: None,
                new_group_name: Some("General".into()),
            })
            .unwrap();

        let templates = store.list_templates(None, None).unwrap();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].group_name, "General");
    }
}
