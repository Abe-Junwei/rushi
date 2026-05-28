pub(crate) const MANIFEST_URL_ENV: &str = "RUSHI_LOCAL_RUNTIME_MANIFEST_URL";
pub(crate) const ALLOW_INSECURE_MANIFEST_ENV: &str = "RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST";

pub fn configured_manifest_source() -> Option<String> {
    let raw = std::env::var(MANIFEST_URL_ENV).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn insecure_manifest_source_allowed() -> bool {
    match std::env::var(ALLOW_INSECURE_MANIFEST_ENV).ok().as_deref() {
        Some("1") => true,
        Some("0") => false,
        _ => cfg!(debug_assertions),
    }
}

pub(crate) fn is_https_source(source: &str) -> bool {
    source.strip_prefix("https://").is_some()
}

pub(crate) fn validate_manifest_source_policy(source: &str) -> Result<(), String> {
    if is_https_source(source) || insecure_manifest_source_allowed() {
        Ok(())
    } else {
        Err("local_runtime_manifest_source_rejected".into())
    }
}
