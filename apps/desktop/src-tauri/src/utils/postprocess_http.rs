//! 后处理 LLM HTTP：本机 loopback 走 no_proxy + 更长超时，避免系统代理与短超时误伤 Ollama。

use std::sync::OnceLock;
use std::time::Duration;
use url::Url;

static LOOPBACK_ASYNC_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn is_loopback_host(host: Option<&str>) -> bool {
    matches!(host, Some("127.0.0.1" | "localhost" | "::1"))
}

pub fn is_loopback_endpoint(endpoint: &Url) -> bool {
    is_loopback_host(endpoint.host_str())
}

fn build_loopback_async_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(15))
        // 与 export_polish_timeout_secs(loopback) 上限一致，避免 client 先于 per-request 超时
        .timeout(Duration::from_secs(900))
        .user_agent(format!("rushi-desktop/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("loopback postprocess reqwest client")
}

/// 本机 Ollama 用直连客户端；云端用全局 `http_client()`（可走系统代理）。
pub fn postprocess_async_client(loopback: bool) -> &'static reqwest::Client {
    if loopback {
        LOOPBACK_ASYNC_CLIENT.get_or_init(build_loopback_async_client)
    } else {
        super::http_client()
    }
}

/// 导出润色单次 LLM 请求超时（秒）。本机 Ollama 需覆盖冷启动 + 长 JSON 生成。
pub fn export_polish_timeout_secs(char_count: usize, loopback: bool) -> u64 {
    if loopback {
        const MIN_SECS: u64 = 120;
        const MAX_SECS: u64 = 900;
        // 长稿 JSON 生成：原 1500 字/秒使 12 万字仅 ~125s，改为 500 字/秒。
        const CHARS_PER_EXTRA_SEC: u64 = 500;
        let extra =
            (char_count as u64 / CHARS_PER_EXTRA_SEC).min(MAX_SECS.saturating_sub(MIN_SECS));
        (MIN_SECS + extra).min(MAX_SECS)
    } else {
        const MIN_SECS: u64 = 45;
        const MAX_SECS: u64 = 180;
        const CHARS_PER_EXTRA_SEC: u64 = 1500;
        let extra =
            (char_count as u64 / CHARS_PER_EXTRA_SEC).min(MAX_SECS.saturating_sub(MIN_SECS));
        (MIN_SECS + extra).min(MAX_SECS)
    }
}

/// 导出润色 completion 所需 max_tokens（OpenAI 兼容字段；Ollama 亦认）。
/// 长稿 lines 数组易被默认 num_predict 截断，导致 JSON 缺闭合括号。
pub fn export_polish_max_tokens(line_count: usize, char_count: usize) -> u32 {
    const MIN: u32 = 1024;
    const MAX: u32 = 28_000;
    let from_lines = line_count.saturating_mul(56) as u32;
    let from_chars = (char_count.saturating_mul(2) as u32).max(512);
    (from_lines.max(from_chars) + 512).clamp(MIN, MAX)
}

pub fn format_postprocess_transport_error(
    err: &reqwest::Error,
    loopback: bool,
    task_label: &str,
) -> String {
    if err.is_timeout() {
        return if loopback {
            format!(
                "{task_label}超时：本机模型处理全文较慢，可缩小导出范围、换更小模型，或稍后重试。"
            )
        } else {
            format!("{task_label}超时，请检查网络或稍后重试。")
        };
    }
    if loopback {
        return format!(
            "{task_label}失败：无法连接本机 LLM（请确认 Ollama 已启动且模型 ID 与 ollama list 一致）。详情：{err}"
        );
    }
    format!("{task_label}失败，请检查网络、模型配置或 API Key。详情：{err}")
}

#[cfg(test)]
mod tests {
    use super::{export_polish_max_tokens, export_polish_timeout_secs};

    #[test]
    fn loopback_timeout_covers_cold_start_and_long_docs() {
        assert_eq!(export_polish_timeout_secs(0, true), 120);
        assert_eq!(export_polish_timeout_secs(3_000, true), 126);
        assert_eq!(export_polish_timeout_secs(120_000, true), 360);
        assert_eq!(export_polish_timeout_secs(500_000, true), 900);
    }

    #[test]
    fn export_polish_max_tokens_scales_with_line_count() {
        assert_eq!(export_polish_max_tokens(0, 0), 1024);
        assert_eq!(export_polish_max_tokens(569, 5895), 28_000);
        assert_eq!(export_polish_max_tokens(10_000, 1_000_000), 28_000);
    }

    #[test]
    fn cloud_timeout_unchanged_order_of_magnitude() {
        assert_eq!(export_polish_timeout_secs(0, false), 45);
        assert_eq!(export_polish_timeout_secs(120_000, false), 125);
        assert_eq!(export_polish_timeout_secs(500_000, false), 180);
    }

    #[test]
    fn loopback_allows_more_time_than_legacy_formula_at_max_input() {
        let legacy_max_at_120k = 45 + 120_000 / 1500;
        let relaxed = export_polish_timeout_secs(120_000, true);
        assert!(relaxed > legacy_max_at_120k);
    }
}
