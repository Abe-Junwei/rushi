use uuid::Uuid;

pub fn segment_uid_or_new(uid: &Option<String>) -> String {
    uid.as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}
