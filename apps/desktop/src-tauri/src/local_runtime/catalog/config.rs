pub(crate) const MANIFEST_URL_ENV: &str = "RUSHI_LOCAL_RUNTIME_MANIFEST_URL";
pub(crate) const ALLOW_INSECURE_MANIFEST_ENV: &str = "RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST";

/// Compile-time default HTTPS manifest URL (set via `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL` when building the shell).
const DEFAULT_MANIFEST_URL: Option<&str> = option_env!("RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL");

fn trim_non_empty(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub(crate) fn default_manifest_source() -> Option<String> {
    DEFAULT_MANIFEST_URL.and_then(|url| trim_non_empty(url))
}

/// Runtime env overrides compile-time default.
pub fn configured_manifest_source() -> Option<String> {
    std::env::var(MANIFEST_URL_ENV)
        .ok()
        .and_then(|raw| trim_non_empty(&raw))
        .or_else(default_manifest_source)
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

#[cfg(test)]
mod tests {
    use super::{configured_manifest_source, default_manifest_source, MANIFEST_URL_ENV};

    #[test]
    fn runtime_env_overrides_compile_time_default() {
        let prior = std::env::var(MANIFEST_URL_ENV).ok();
        std::env::set_var(MANIFEST_URL_ENV, "https://example.invalid/runtime-manifest.json");
        assert_eq!(
            configured_manifest_source().as_deref(),
            Some("https://example.invalid/runtime-manifest.json")
        );
        match prior {
            Some(value) => std::env::set_var(MANIFEST_URL_ENV, value),
            None => std::env::remove_var(MANIFEST_URL_ENV),
        }
    }

    #[test]
    fn default_manifest_source_matches_compile_time_option() {
        assert_eq!(default_manifest_source(), super::DEFAULT_MANIFEST_URL.and_then(|url| {
            let trimmed = url.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }));
    }
}
