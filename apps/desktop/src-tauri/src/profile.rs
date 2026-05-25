use std::fs;

use serde::{Deserialize, Serialize};
use serde_yaml::Value;

const PROFILE_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SettingsProfileV1 {
    pub version: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub llm: Option<LlmProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub online_stt: Option<OnlineSttProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct LlmProfile {
    pub provider_id: String,
    pub base_url: String,
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct OnlineSttProfile {
    pub enabled: bool,
    pub provider_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_key: Option<String>,
    pub timeout_ms: u64,
}

#[tauri::command]
pub fn export_settings_profile(profile: SettingsProfileV1) -> Result<Option<String>, String> {
    validate_profile(&profile)?;
    let picked = rfd::FileDialog::new()
        .add_filter("YAML", &["yaml", "yml"])
        .set_file_name("rushi-profile.yaml")
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err("目标文件已存在，请另选文件名或先删除该文件。".to_string());
    }
    let body = serialize_profile_yaml(&profile)?;
    fs::write(&path, body).map_err(|e| format!("写入 profile 失败: {e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn import_settings_profile() -> Result<Option<SettingsProfileV1>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("Profile", &["yaml", "yml", "json"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    let body = fs::read_to_string(&path).map_err(|e| format!("读取 profile 失败: {e}"))?;
    parse_profile_text(&body).map(Some)
}

fn serialize_profile_yaml(profile: &SettingsProfileV1) -> Result<String, String> {
    serde_yaml::to_string(profile).map_err(|e| format!("序列化 profile 失败: {e}"))
}

fn parse_profile_text(body: &str) -> Result<SettingsProfileV1, String> {
    let raw: Value = serde_yaml::from_str(body).map_err(|e| format!("profile 格式无效：{e}"))?;
    if let Some(field) = find_forbidden_secret_field(&raw) {
        return Err(format!(
            "profile 含敏感字段 `{field}`，请移除 API Key / Token / Secret 后再导入。"
        ));
    }
    let profile: SettingsProfileV1 =
        serde_yaml::from_value(raw).map_err(|e| format!("profile 字段无效：{e}"))?;
    validate_profile(&profile)?;
    Ok(profile)
}

fn validate_profile(profile: &SettingsProfileV1) -> Result<(), String> {
    if profile.version != PROFILE_VERSION {
        return Err(format!(
            "仅支持导入 version={} 的 profile，当前为 {}。",
            PROFILE_VERSION, profile.version
        ));
    }
    if let Some(llm) = profile.llm.as_ref() {
        if llm.provider_id.trim().is_empty()
            || llm.base_url.trim().is_empty()
            || llm.model.trim().is_empty()
        {
            return Err("LLM profile 缺少 provider_id / base_url / model。".to_string());
        }
    }
    if let Some(stt) = profile.online_stt.as_ref() {
        if stt.provider_id.trim().is_empty() {
            return Err("在线 STT profile 缺少 provider_id。".to_string());
        }
    }
    Ok(())
}

fn find_forbidden_secret_field(value: &Value) -> Option<&'static str> {
    match value {
        Value::Mapping(map) => {
            for (key, nested) in map {
                if let Value::String(name) = key {
                    if let Some(hit) = normalize_forbidden_secret_key(name) {
                        return Some(hit);
                    }
                }
                if let Some(hit) = find_forbidden_secret_field(nested) {
                    return Some(hit);
                }
            }
            None
        }
        Value::Sequence(items) => items.iter().find_map(find_forbidden_secret_field),
        _ => None,
    }
}

fn normalize_forbidden_secret_key(raw: &str) -> Option<&'static str> {
    match raw {
        "api_key" | "apiKey" => Some("api_key"),
        "authorization" | "Authorization" => Some("authorization"),
        "secret" | "secrets" | "api_secret" | "apiSecret" => Some("secret"),
        "token" | "access_token" | "accessToken" => Some("token"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        parse_profile_text, serialize_profile_yaml, LlmProfile, OnlineSttProfile, SettingsProfileV1,
    };

    #[test]
    fn round_trip_yaml_profile() {
        let profile = SettingsProfileV1 {
            version: 1,
            llm: Some(LlmProfile {
                provider_id: "deepseek".into(),
                base_url: "https://api.deepseek.com/v1".into(),
                model: "deepseek-chat".into(),
                api_key_id: Some("default".into()),
            }),
            online_stt: Some(OnlineSttProfile {
                enabled: true,
                provider_id: "openai".into(),
                endpoint: Some("https://api.openai.com/v1/audio/transcriptions".into()),
                app_key: None,
                timeout_ms: 30_000,
            }),
        };

        let yaml = serialize_profile_yaml(&profile).unwrap();
        let parsed = parse_profile_text(&yaml).unwrap();
        assert_eq!(parsed, profile);
    }

    #[test]
    fn reject_profile_with_secret_field() {
        let err = parse_profile_text(
            r#"
version: 1
llm:
  provider_id: deepseek
  base_url: https://api.deepseek.com/v1
  model: deepseek-chat
  api_key: sk-test
"#,
        )
        .unwrap_err();

        assert!(err.contains("敏感字段"));
    }

    #[test]
    fn reject_unknown_version() {
        let err = parse_profile_text(
            r#"
version: 2
llm:
  provider_id: deepseek
  base_url: https://api.deepseek.com/v1
  model: deepseek-chat
"#,
        )
        .unwrap_err();

        assert!(err.contains("version=1"));
    }
}
