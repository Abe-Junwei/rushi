//! 各在线 STT 厂商原生 HTTP 调用，归一为 Rushi `TranscriptionResult` JSON（schema_version 1）。

pub mod dashscope_asr;
pub mod dashscope_file_asr;
pub mod dashscope_upload;
pub mod dashscope_vocabulary;
pub mod deepgram;

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::json;
use std::sync::OnceLock;
use tokio_util::io::ReaderStream;

use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, OnlineTranscribeBridge};
use crate::project::stt_vocabulary::SttVocabularyPlan;
use crate::project::transcribe_cancel_cmd::TranscribeCancelPoll;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
static HTTP_DIRECT: OnceLock<reqwest::Client> = OnceLock::new();
const MAX_STT_AUDIO_BYTES: u64 = 512 * 1024 * 1024;

fn build_stt_http_client(use_system_proxy: bool) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(20))
        .user_agent(format!("rushi-desktop/{}", env!("CARGO_PKG_VERSION")));
    if !use_system_proxy {
        builder = builder.no_proxy();
    }
    builder.build().expect("reqwest stt async client")
}

pub fn http_client() -> &'static reqwest::Client {
    HTTP.get_or_init(|| build_stt_http_client(true))
}

/// 绕过系统代理直连云端（与 STT 探测 / LLM postprocess 的 no_proxy 重试一致）。
pub fn http_client_direct() -> &'static reqwest::Client {
    HTTP_DIRECT.get_or_init(|| build_stt_http_client(false))
}

pub fn is_retryable_stt_transport(err: &reqwest::Error) -> bool {
    err.is_connect() || err.is_timeout() || err.is_request()
}

/// 云端 STT GET：代理路径失败时自动 no_proxy 重试一次。
pub async fn send_stt_cloud_get(
    build: impl Fn(&reqwest::Client) -> reqwest::RequestBuilder,
) -> Result<reqwest::Response, reqwest::Error> {
    let primary = build(http_client()).send().await;
    match primary {
        Ok(resp) => Ok(resp),
        Err(e) if is_retryable_stt_transport(&e) => build(http_client_direct()).send().await,
        Err(e) => Err(e),
    }
}

/// 云端 STT POST：代理路径失败时自动 no_proxy 重试一次。
pub async fn send_stt_cloud_post(
    build: impl Fn(&reqwest::Client) -> reqwest::RequestBuilder,
) -> Result<reqwest::Response, reqwest::Error> {
    let primary = build(http_client()).send().await;
    match primary {
        Ok(resp) => Ok(resp),
        Err(e) if is_retryable_stt_transport(&e) => build(http_client_direct()).send().await,
        Err(e) => Err(e),
    }
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

pub(crate) async fn multipart_part_from_file(
    path: &Path,
) -> Result<reqwest::multipart::Part, String> {
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

pub struct NativeTranscribeDispatch<'a> {
    pub bridge: &'a OnlineTranscribeBridge,
    pub vocabulary: &'a SttVocabularyPlan,
    pub timeout: Duration,
    pub cancel: TranscribeCancelPoll<'a>,
}

pub async fn dispatch_native(
    adapter: &str,
    client: &reqwest::Client,
    audio_path: &Path,
    dispatch: NativeTranscribeDispatch<'_>,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let raw_url = dispatch.bridge.transcribe_url.trim();
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
        "dashscopeAsr" => {
            dashscope_asr::transcribe_dashscope_asr(
                client,
                audio_path,
                dispatch.bridge,
                dispatch.vocabulary,
                dispatch.timeout,
                log,
                dispatch.cancel,
            )
            .await
        }
        "deepgramListen" => {
            deepgram::transcribe_deepgram(
                client,
                audio_path,
                dispatch.bridge,
                dispatch.vocabulary,
                dispatch.timeout,
                log,
                dispatch.cancel,
            )
            .await
        }
        _ => Err(format!("未知 native_adapter: {adapter}")),
    }
}
