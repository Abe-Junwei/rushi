//! 在线转写桥接载荷（Tauri ↔ 前端 camelCase），与 `sttOnlineProviderContract` 对齐。

use serde::Deserialize;
use url::Url;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineTranscribeBridge {
    /// 自定义网关 POST URL，或各厂商默认端点（可为空串由壳填默认）。
    pub transcribe_url: String,
    /// 本会话输入的凭证；已保存凭证优先通过 api_key_id 在 Rust 内解析。
    pub authorization: Option<String>,
    #[serde(default)]
    pub api_key_id: Option<String>,
    #[serde(default)]
    pub api_secret_id: Option<String>,
    pub timeout_sec: Option<u64>,
    /// 如 `openaiAudio`、`assemblyai`、`dashscopeAsr`、`deepgramListen` 等。
    #[serde(default)]
    pub native_adapter: Option<String>,
    /// AppKey / SecretId 等可持久化标识；网关 multipart 时作 `X-Rushi-Stt-App-Key`。
    #[serde(default)]
    pub app_key: Option<String>,
    /// 本会话输入的 APISecret；已保存凭证通过 api_secret_id 解析。
    #[serde(default)]
    pub api_secret: Option<String>,
    /// 讯飞 `business.accent`。
    #[serde(default)]
    pub accent: Option<String>,
}

impl OnlineTranscribeBridge {
    /// Saved credentials stay inside Rust; adapters keep their existing wire formats.
    pub fn resolve_credentials(&self, root: &std::path::Path) -> Result<Self, String> {
        let mut resolved = self.clone();
        if let Some(id) = self.api_key_id.as_deref() {
            let key = crate::stt_online_secret_store::read_stt_secret(root, id)?
                .ok_or_else(|| "在线 STT 密钥不存在，请重新保存。".to_string())?;
            resolved.authorization = Some(match self.native_adapter.as_deref() {
                Some("assemblyai" | "xunfeiSpeedAsr") => key,
                _ => format!("Bearer {key}"),
            });
        }
        if let Some(id) = self.api_secret_id.as_deref() {
            resolved.api_secret = Some(
                crate::stt_online_secret_store::read_stt_secret(root, id)?
                    .ok_or_else(|| "在线 STT APISecret 不存在，请重新保存。".to_string())?,
            );
        }
        Ok(resolved)
    }
}

pub fn is_allowed_stt_transcribe_url(raw: &str) -> bool {
    let Ok(u) = Url::parse(raw.trim()) else {
        return false;
    };
    match u.scheme() {
        "https" => !u.cannot_be_a_base(),
        "http" => {
            let Some(host) = u.host_str() else {
                return false;
            };
            let h = host.to_ascii_lowercase();
            h == "localhost" || h == "127.0.0.1" || h == "::1"
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_saved_credentials_without_a_renderer_read_command() {
        let root =
            std::env::temp_dir().join(format!("rushi-stt-boundary-{}", uuid::Uuid::new_v4()));
        let dir = root.join("secrets/stt-online");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("synthetic-key.key"), "synthetic-key").unwrap();
        std::fs::write(dir.join("synthetic-secret.key"), "synthetic-secret").unwrap();
        let bridge: OnlineTranscribeBridge = serde_json::from_value(serde_json::json!({
            "transcribeUrl": "https://example.com/", "nativeAdapter": "xunfeiSpeedAsr",
            "apiKeyId": "synthetic-key", "apiSecretId": "synthetic-secret"
        }))
        .unwrap();
        let resolved = bridge.resolve_credentials(&root).unwrap();
        assert_eq!(resolved.authorization.as_deref(), Some("synthetic-key"));
        assert_eq!(resolved.api_secret.as_deref(), Some("synthetic-secret"));
        assert!(bridge.authorization.is_none());
        let mut missing = bridge.clone();
        missing.api_key_id = Some("../synthetic-key".into());
        assert!(missing.resolve_credentials(&root).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn allows_https_urls() {
        assert!(is_allowed_stt_transcribe_url(
            "https://api.openai.com/v1/audio/transcriptions"
        ));
        assert!(is_allowed_stt_transcribe_url("https://example.com/"));
    }

    #[test]
    fn allows_localhost_http() {
        assert!(is_allowed_stt_transcribe_url(
            "http://127.0.0.1:8741/v1/transcribe"
        ));
        assert!(is_allowed_stt_transcribe_url("http://localhost:3000/api"));
    }

    #[test]
    fn rejects_non_local_http() {
        assert!(!is_allowed_stt_transcribe_url("http://evil.com/"));
        assert!(!is_allowed_stt_transcribe_url("http://192.168.1.1/"));
    }

    #[test]
    fn rejects_malformed_urls() {
        assert!(!is_allowed_stt_transcribe_url("not-a-url"));
        assert!(!is_allowed_stt_transcribe_url(""));
        assert!(!is_allowed_stt_transcribe_url("ftp://example.com/"));
    }

    #[test]
    fn rejects_ssrf_bypass_attempts() {
        // 旧版 starts_with 风格校验会被绕过的 case
        assert!(!is_allowed_stt_transcribe_url(
            "http://127.0.0.1:80@evil.com/"
        ));
        assert!(!is_allowed_stt_transcribe_url("http://localhost.evil.com/"));
    }
}
