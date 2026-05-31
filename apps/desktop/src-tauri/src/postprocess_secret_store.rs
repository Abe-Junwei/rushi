use std::fs;
use std::path::{Path, PathBuf};

const SECRETS_DIR: &str = "secrets/postprocess";

pub fn llm_secret_path(app_data_root: &Path, api_key_id: &str) -> PathBuf {
    app_data_root
        .join(SECRETS_DIR)
        .join(format!("{api_key_id}.key"))
}

fn secrets_dir(app_data_root: &Path) -> PathBuf {
    app_data_root.join(SECRETS_DIR)
}

pub fn write_llm_secret(
    app_data_root: &Path,
    api_key_id: &str,
    api_key: &str,
) -> Result<(), String> {
    let dir = secrets_dir(app_data_root);
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建本地密钥目录：{e}"))?;
    let path = llm_secret_path(app_data_root, api_key_id);
    fs::write(&path, api_key.as_bytes()).map_err(|e| format!("写入 LLM API Key 失败：{e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("设置密钥文件权限失败：{e}"))?;
    }
    Ok(())
}

pub fn llm_secret_exists(app_data_root: &Path, api_key_id: &str) -> Result<bool, String> {
    Ok(llm_secret_path(app_data_root, api_key_id).is_file())
}

pub fn read_llm_secret(app_data_root: &Path, api_key_id: &str) -> Result<Option<String>, String> {
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

pub fn delete_llm_secret(app_data_root: &Path, api_key_id: &str) -> Result<(), String> {
    let path = llm_secret_path(app_data_root, api_key_id);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除 LLM API Key 失败：{e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn secret_roundtrip_in_app_data_dir() {
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
    }
}
