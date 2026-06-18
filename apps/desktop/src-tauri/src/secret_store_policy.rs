//! Platform policy for LLM / STT API key storage (file vs OS keyring).

pub fn force_file_store() -> bool {
    std::env::var("RUSHI_LLM_SECRET_FORCE_FILE").ok().as_deref() == Some("1")
}

#[cfg(not(target_os = "macos"))]
fn force_keyring_store() -> bool {
    std::env::var("RUSHI_LLM_SECRET_USE_KEYRING")
        .ok()
        .as_deref()
        == Some("1")
}

/// Primary store for new reads/writes.
/// macOS always uses App Support file (`0600`); Keychain login prompts are disabled on macOS.
pub fn use_keyring_store() -> bool {
    if force_file_store() {
        return false;
    }
    #[cfg(target_os = "macos")]
    {
        false
    }
    #[cfg(not(target_os = "macos"))]
    {
        if force_keyring_store() {
            return true;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_file_overrides_keyring() {
        std::env::set_var("RUSHI_LLM_SECRET_FORCE_FILE", "1");
        std::env::set_var("RUSHI_LLM_SECRET_USE_KEYRING", "1");
        assert!(!use_keyring_store());
        std::env::remove_var("RUSHI_LLM_SECRET_FORCE_FILE");
        std::env::remove_var("RUSHI_LLM_SECRET_USE_KEYRING");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_never_uses_keyring_even_when_forced() {
        std::env::remove_var("RUSHI_LLM_SECRET_FORCE_FILE");
        std::env::set_var("RUSHI_LLM_SECRET_USE_KEYRING", "1");
        assert!(!use_keyring_store());
        std::env::remove_var("RUSHI_LLM_SECRET_USE_KEYRING");
    }
}
