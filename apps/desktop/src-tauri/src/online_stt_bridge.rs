//! 在线转写桥接载荷（Tauri ↔ 前端 camelCase），与 `sttOnlineProviderContract` 对齐。

use serde::Deserialize;
use url::Url;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineTranscribeBridge {
    /// 自定义网关 POST URL，或各厂商默认端点（可为空串由壳填默认）。
    pub transcribe_url: String,
    /// Bearer / Token / 订阅密钥等；部分厂商约定为内存 Secret（见 `native_adapter`）。
    pub authorization: Option<String>,
    pub timeout_sec: Option<u64>,
    /// 如 `openaiAudio`、`assemblyai`、`baiduSpeech`、`tencentAsr` 等。
    #[serde(default)]
    pub native_adapter: Option<String>,
    /// AppKey / SecretId 等可持久化标识；网关 multipart 时作 `X-Rushi-Stt-App-Key`。
    #[serde(default)]
    pub app_key: Option<String>,
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
