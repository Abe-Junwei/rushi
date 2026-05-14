//! 各在线 STT 厂商原生 HTTP 调用，归一为 Rushi `TranscriptionResult` JSON（schema_version 1）。

pub mod baidu;
pub mod aliyun;
pub mod deepgram;
pub mod tencent;
pub mod azure;
pub mod google;

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::json;
use std::sync::OnceLock;
use tokio_util::io::ReaderStream;

use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, OnlineTranscribeBridge};

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
const MAX_STT_AUDIO_BYTES: u64 = 512 * 1024 * 1024;

pub fn http_client() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(20))
            .build()
            .expect("reqwest async client")
    })
}

pub(crate) fn read_audio_bytes_limited(path: &Path) -> Result<Vec<u8>, String> {
    let meta = fs::metadata(path).map_err(|e| format!("读取音频元数据: {e}"))?;
    if meta.len() > MAX_STT_AUDIO_BYTES {
        return Err(format!(
            "音频文件过大（{} bytes），超过 {} bytes 限制。",
            meta.len(),
            MAX_STT_AUDIO_BYTES
        ));
    }
    fs::read(path).map_err(|e| format!("读取音频: {e}"))
}

pub(crate) async fn multipart_part_from_file(path: &Path) -> Result<reqwest::multipart::Part, String> {
    let meta = fs::metadata(path).map_err(|e| format!("读取音频元数据: {e}"))?;
    if meta.len() > MAX_STT_AUDIO_BYTES {
        return Err(format!(
            "音频文件过大（{} bytes），超过 {} bytes 限制。",
            meta.len(),
            MAX_STT_AUDIO_BYTES
        ));
    }
    let f = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("打开音频文件失败: {e}"))?;
    let stream = ReaderStream::new(f);
    let body = reqwest::Body::wrap_stream(stream);
    let mut part = reqwest::multipart::Part::stream_with_length(body, meta.len());
    if let Some(name) = path.file_name() {
        part = part.file_name(name.to_string_lossy().into_owned());
    }
    Ok(part)
}

fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(data);
    hex::encode(h.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn rushi_value(
    segments: Vec<serde_json::Value>,
    full_text: String,
    engine: &str,
    duration_sec: Option<f64>,
    mut warnings: Vec<String>,
) -> serde_json::Value {
    if segments.is_empty() && !full_text.trim().is_empty() {
        warnings.push("厂商未返回分句时间戳，已退化为单条语段。".to_string());
    }
    let segs = if segments.is_empty() && !full_text.trim().is_empty() {
        vec![json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
        })]
    } else {
        segments
    };
    json!({
        "schema_version": "1",
        "segments": segs,
        "full_text": full_text,
        "engine": engine,
        "duration_sec": duration_sec,
        "warnings": warnings,
    })
}

pub(crate) fn audio_bytes_and_format(path: &Path) -> Result<(Vec<u8>, &'static str), String> {
    let bytes = read_audio_bytes_limited(path)?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let fmt = match ext.as_str() {
        "wav" => "wav",
        "mp3" => "mp3",
        "m4a" | "aac" => "m4a",
        "pcm" => "pcm",
        "amr" => "amr",
        "flac" => "flac",
        "ogg" => "ogg",
        _ => "wav",
    };
    Ok((bytes, fmt))
}

pub async fn dispatch_native(
    adapter: &str,
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let raw_url = bridge.transcribe_url.trim();
    if !raw_url.is_empty() {
        let scheme_ok = url::Url::parse(raw_url)
            .map(|u| matches!(u.scheme(), "http" | "https"))
            .unwrap_or(false);
        if scheme_ok && !is_allowed_stt_transcribe_url(raw_url) {
            return Err(
                "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
            );
        }
    }
    match adapter {
        "baiduSpeech" => baidu::transcribe_baidu(client, audio_path, bridge, timeout, log).await,
        "aliyunNls" => aliyun::transcribe_aliyun_nls(client, audio_path, bridge, timeout, log).await,
        "deepgramListen" => deepgram::transcribe_deepgram(client, audio_path, bridge, timeout, log).await,
        "tencentAsr" => tencent::transcribe_tencent(client, audio_path, bridge, timeout, log).await,
        "azureConversationV1" => {
            azure::transcribe_azure_conversation(client, audio_path, bridge, timeout, log).await
        }
        "googleSpeechV1" => google::transcribe_google(client, audio_path, bridge, timeout, log).await,
        "iflytekIatWs" => {
            crate::china_stt_shell::iflytek::transcribe_iflytek_iat_ws(audio_path, bridge, timeout, log)
        }
        "huaweiSisShortAudio" => crate::china_stt_shell::huawei::transcribe_huawei_sis_short(
            client, audio_path, bridge, timeout, log,
        ).await,
        "aispeechLasrSentenceV2" => crate::china_stt_shell::aispeech::transcribe_aispeech_lasr(
            client, audio_path, bridge, timeout, log,
        ).await,
        "volcengineBigmodelNostreamWs" => {
            crate::china_stt_shell::volcengine::transcribe_volcengine_bigmodel_nostream_ws(
                audio_path, bridge, timeout, log,
            )
        }
        _ => Err(format!("未知 native_adapter: {adapter}")),
    }
}
