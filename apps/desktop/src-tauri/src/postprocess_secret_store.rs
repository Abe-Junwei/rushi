use std::fs;
use std::path::{Path, PathBuf};

use keyring::Entry;

const SECRETS_DIR: &str = "secrets/postprocess";
const KEYRING_SERVICE: &str = "studio.lingchuang.rushi";
const KEYRING_USER_PREFIX: &str = "llm:";

pub fn llm_secret_path(app_data_root: &Path, api_key_id: &str) -> PathBuf {
    app_data_root
        .join(SECRETS_DIR)
        .join(format!("{api_key_id}.key"))
}

fn secrets_dir(app_data_root: &Path) -> PathBuf {
    app_data_root.join(SECRETS_DIR)
}

fn force_file_store() -> bool {
    std::env::var("RUSHI_LLM_SECRET_FORCE_FILE")
        .ok()
        .as_deref()
        == Some("1")
}

fn keyring_user(api_key_id: &str) -> String {
    format!("{KEYRING_USER_PREFIX}{api_key_id}")
}

fn keyring_entry(api_key_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &keyring_user(api_key_id))
        .map_err(|e| format!("无法打开系统密钥库：{e}"))
}

fn read_keyring_secret(api_key_id: &str) -> Result<Option<String>, String> {
    if force_file_store() {
        return Ok(None);
    }
    let entry = match keyring_entry(api_key_id) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };
    match entry.get_password() {
        Ok(key) if key.trim().is_empty() => Ok(None),
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取系统密钥库失败：{e}")),
    }
}

fn write_keyring_secret(api_key_id: &str, api_key: &str) -> Result<(), String> {
    if force_file_store() {
        return Err("keyring_disabled".into());
    }
    let entry = keyring_entry(api_key_id)?;
    entry
        .set_password(api_key)
        .map_err(|e| format!("写入系统密钥库失败：{e}"))
}

fn delete_keyring_secret(api_key_id: &str) -> Result<(), String> {
    if force_file_store() {
        return Ok(());
    }
    let Ok(entry) = keyring_entry(api_key_id) else {
        return Ok(());
    };
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除系统密钥库条目失败：{e}")),
    }
}

fn keyring_secret_exists(api_key_id: &str) -> Result<bool, String> {
    Ok(read_keyring_secret(api_key_id)?.is_some())
}

fn write_file_secret(
    app_data_root: &Path,
    api_key_id: &str,
    api_key: &str,
) -> Result<(), String> {
    let dir = secrets_dir(app_data_root);
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建本地密钥目录：{e}"))?;
    let path = llm_secret_path(app_data_root, api_key_id);
    fs::write(&path, api_key.as_bytes()).map_err(|e| format!("写入 LLM API Key 失败：{e}"))?;
    restrict_secret_file_permissions(&path)?;
    Ok(())
}

fn restrict_secret_file_permissions(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("设置密钥文件权限失败：{e}"))?;
    }
    #[cfg(windows)]
    {
        let _ = path;
        // AppData is per-user; keyring is the primary store on Windows.
    }
    Ok(())
}

fn read_file_secret(app_data_root: &Path, api_key_id: &str) -> Result<Option<String>, String> {
    let path = llm_secret_path(app_data_root, api_key_id);
    if !path.is_file() {
        return Ok(None);
    }
    let key = fs::read_to_string(&path).map_err(|e| format!("无法读取本地 API Key：{e}"))?;
    let trimmed = key.trim();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

fn delete_file_secret(app_data_root: &Path, api_key_id: &str) -> Result<(), String> {
    let path = llm_secret_path(app_data_root, api_key_id);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除 LLM API Key 文件失败：{e}")),
    }
}

fn migrate_file_to_keyring(app_data_root: &Path, api_key_id: &str, key: &str) {
    if write_keyring_secret(api_key_id, key).is_ok() {
        let _ = delete_file_secret(app_data_root, api_key_id);
    }
}

pub fn write_llm_secret(
    app_data_root: &Path,
    api_key_id: &str,
    api_key: &str,
) -> Result<(), String> {
    if !force_file_store() {
        if write_keyring_secret(api_key_id, api_key).is_ok() {
            let _ = delete_file_secret(app_data_root, api_key_id);
            return Ok(());
        }
    }
    write_file_secret(app_data_root, api_key_id, api_key)
}

pub fn llm_secret_exists(app_data_root: &Path, api_key_id: &str) -> Result<bool, String> {
    if keyring_secret_exists(api_key_id)? {
        return Ok(true);
    }
    Ok(llm_secret_path(app_data_root, api_key_id).is_file())
}

pub fn read_llm_secret(app_data_root: &Path, api_key_id: &str) -> Result<Option<String>, String> {
    if let Some(key) = read_keyring_secret(api_key_id)? {
        return Ok(Some(key));
    }
    if let Some(key) = read_file_secret(app_data_root, api_key_id)? {
        migrate_file_to_keyring(app_data_root, api_key_id, &key);
        return Ok(Some(key));
    }
    Ok(None)
}

pub fn delete_llm_secret(app_data_root: &Path, api_key_id: &str) -> Result<(), String> {
    delete_keyring_secret(api_key_id)?;
    delete_file_secret(app_data_root, api_key_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn secret_roundtrip_in_app_data_dir() {
        std::env::set_var("RUSHI_LLM_SECRET_FORCE_FILE", "1");
        let root = std::env::temp_dir().join(format!("rushi-llm-secret-{}", Uuid::new_v4()));
        write_llm_secret(&root, "default", "sk-roundtrip-test").unwrap();
        assert!(llm_secret_exists(&root, "default").unwrap());
        assert_eq!(
            read_llm_secret(&root, "default").unwrap().as_deref(),
            Some("sk-roundtrip-test")
        );
        delete_llm_secret(&root, "default").unwrap();
        assert!(!llm_secret_exists(&root, "default").unwrap());
        let _ = fs::remove_dir_all(&root);
        std::env::remove_var("RUSHI_LLM_SECRET_FORCE_FILE");
    }
}
