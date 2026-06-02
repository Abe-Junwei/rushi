//! User-facing errors for local ASR HTTP transcribe (R3e-A).

use std::time::Duration;

pub fn describe_transcribe_request_error(err: &reqwest::Error, timeout: Duration) -> String {
    let waited = timeout.as_secs();
    if err.is_timeout() {
        return format!(
            "本机 ASR 请求超时（已等待约 {waited} 秒）。长音频请关闭占内存应用后重试；完整分段转写能力将在后续版本提供。"
        );
    }

    let detail = err.to_string();
    let lower = detail.to_ascii_lowercase();

    if err.is_connect() || lower.contains("connection refused") {
        return "无法连接本机 ASR（127.0.0.1:8741 拒绝连接）。请在「环境与 ASR」执行一键准备，或确认侧车已启动。".into();
    }

    if lower.contains("error sending request")
        || lower.contains("connection reset")
        || lower.contains("broken pipe")
        || lower.contains("unexpected eof")
    {
        return "无法连接本机 ASR：侧车可能已崩溃或未响应（常见于 FunASR 内存不足被系统终止）。请回到「环境与 ASR」查看状态并重新一键准备。".into();
    }

    format!("ASR 请求失败: {detail}")
}

/// Map `ASR HTTP 401: {"detail":"invalid_local_token"}` to actionable copy.
pub fn describe_transcribe_http_status_error(status: u16, body_snippet: &str) -> Option<String> {
    if status != 401 {
        return None;
    }
    let lower = body_snippet.to_ascii_lowercase();
    if !lower.contains("invalid_local_token") {
        return None;
    }
    Some(
        "本机 ASR 拒绝了转写请求（本地安全令牌不匹配）。\
         常见于 8741 上仍是上一次内置侧车、而桌面已重启。\
         请到「环境与 ASR」点「重试内置侧车」，或完全退出应用后重新打开；\
         开发时也可执行 lsof -i :8741 结束旧进程后重新 npm run desktop:dev。"
            .into(),
    )
}

pub fn describe_transcribe_payload_error(code: &str, message: &str) -> String {
    let lower_code = code.to_ascii_lowercase();
    let lower_msg = message.to_ascii_lowercase();
    if lower_code.contains("ffmpeg_timeout")
        || lower_msg.contains("ffmpeg_timeout")
        || lower_code.contains("ffmpeg_failed")
    {
        return format!(
            "音频规范化失败（{code}）：{message}。源文件过长或编码异常时可尝试先在外部转成较短片段。"
        );
    }
    if lower_msg.contains("funasr_generate_failed")
        || lower_msg.contains("out of memory")
        || lower_msg.contains("oom")
        || lower_code.contains("funasr")
    {
        return format!(
            "FunASR 推理失败（{code}）：{message}。长音频易占用大量内存，请关闭其他占内存应用后重试。"
        );
    }
    format!("ASR 返回错误 ({code}): {message}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_error_maps_ffmpeg_timeout() {
        let msg = describe_transcribe_payload_error("ffmpeg_error", "ffmpeg_timeout:1200");
        assert!(msg.contains("规范化"));
    }

    #[test]
    fn http_401_invalid_local_token_maps_actionable() {
        let msg = describe_transcribe_http_status_error(401, r#"{"detail":"invalid_local_token"}"#)
            .expect("mapped");
        assert!(msg.contains("令牌"));
        assert!(describe_transcribe_http_status_error(404, "not found").is_none());
    }
}
