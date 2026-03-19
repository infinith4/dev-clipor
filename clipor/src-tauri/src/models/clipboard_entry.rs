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
    /// "text" or "image"
    pub content_type: String,
    /// Base64-encoded PNG data (only for image entries)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_data: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistoryPage {
    pub entries: Vec<ClipboardEntry>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}
