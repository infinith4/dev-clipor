use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardEntry {
    pub id: i64,
    pub text: String,
    pub copied_at: String,
    pub source_app: Option<String>,
    pub is_pinned: bool,
    pub char_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistoryPage {
    pub entries: Vec<ClipboardEntry>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}
