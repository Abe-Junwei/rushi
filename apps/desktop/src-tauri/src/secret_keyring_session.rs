//! Process-lifetime cache for macOS Keychain reads.
//! Avoids repeated user password prompts when the same secret is accessed many times per session.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static KEYRING_READ_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, String>> {
    KEYRING_READ_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn read_cached<F>(cache_key: &str, read: F) -> Result<Option<String>, String>
where
    F: FnOnce() -> Result<Option<String>, String>,
{
    if let Ok(guard) = cache().lock() {
        if let Some(value) = guard.get(cache_key) {
            return Ok(Some(value.clone()));
        }
    }

    let value = read()?;
    if let Some(key) = value.as_ref().filter(|k| !k.trim().is_empty()) {
        if let Ok(mut guard) = cache().lock() {
            guard.insert(cache_key.to_string(), key.clone());
        }
    }
    Ok(value)
}

pub fn invalidate(cache_key: &str) {
    if let Ok(mut guard) = cache().lock() {
        guard.remove(cache_key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_cached_hits_once_per_key() {
        let key = format!("test-cache-{}", uuid::Uuid::new_v4());
        let mut calls = 0u8;
        let read = || {
            calls += 1;
            Ok(Some("secret-value".to_string()))
        };
        assert_eq!(
            read_cached(&key, read).unwrap().as_deref(),
            Some("secret-value")
        );
        assert_eq!(
            read_cached(&key, || {
                calls += 1;
                Ok(Some("ignored".to_string()))
            })
            .unwrap()
            .as_deref(),
            Some("secret-value")
        );
        assert_eq!(calls, 1);
        invalidate(&key);
    }
}
