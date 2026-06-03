//! 交付导出大模型润色 Tauri 命令（HTTP + 可取消）。

use crate::project::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;
use tauri::State;

use super::postprocess_export_polish;
use super::{
    extract_chat_completion_text, resolve_runtime_postprocess_config, PostprocessCancelState,
    PostprocessRuntimeBridge,
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessExportPolishRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub body: String,
    pub runtime: PostprocessRuntimeBridge,
    /// 稳定纠错规则摘要，注入 prompt（可选）。
    #[serde(default)]
    pub rule_hints: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessExportPolishResponse {
    pub punct_lines: Vec<String>,
    pub break_after_line: Vec<usize>,
    pub provider: String,
    pub latency_ms: u64,
}

fn export_polish_timeout_secs(char_count: usize) -> u64 {
    const MIN_SECS: u64 = 30;
    const MAX_SECS: u64 = 120;
    let extra = (char_count as u64 / 2000).min(90);
    (MIN_SECS + extra).min(MAX_SECS)
}

#[tauri::command]
pub async fn postprocess_export_polish(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessExportPolishRequest,
) -> Result<PostprocessExportPolishResponse, String> {
    let task = req.task.trim();
    if task != "export_polish" && task != "lecture_paragraphs" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    let body = req.body.trim();
    if body.is_empty() {
        return Err("正文为空，无法润色。".to_string());
    }
    if body.chars().count() > postprocess_export_polish::MAX_EXPORT_POLISH_INPUT_CHARS {
        return Err(format!(
            "正文过长（超过 {} 字），请先删减语段或取消大模型润色。",
            postprocess_export_polish::MAX_EXPORT_POLISH_INPUT_CHARS
        ));
    }

    let app_root = state.root.clone();
    let rt = req.runtime.clone();
    let config = tauri::async_runtime::spawn_blocking(move || {
        resolve_runtime_postprocess_config(&rt, &app_root)
    })
    .await
    .map_err(|e| format!("无法解析 LLM 配置：{e}"))??;

    let api_key = config.api_key.clone();
    let line_count = postprocess_export_polish::count_body_lines(body);
    let rule_hints = req
        .rule_hints
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    let prompt = postprocess_export_polish::build_export_polish_prompt(body, line_count, rule_hints);
    let llm_body = json!({
        "model": config.model,
        "temperature": 0.35,
        "messages": [
            {
                "role": "system",
                "content": "你是中文讲稿 ASR 润色助手。lines 会被程序原样写入导出稿，不得增删行。须逐行改正文错字、同音误识别、口语重复字并规范标点；另给 break_after_line。禁止 paragraphs 字段与整句编造。只输出合法 JSON。"
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_export_polish provider={} chars={}",
            config.provider,
            body.chars().count()
        ),
    );

    let char_count = body.chars().count();
    let timeout_secs = export_polish_timeout_secs(char_count);
    let t0 = Instant::now();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);
    let cancel_registration = request_id.as_ref().map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.clone(), handle) {
                previous.abort();
            }
        }
        (id.clone(), registration)
    });

    let http_future = async {
        let resp = http_client()
            .post(config.endpoint.clone())
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .json(&llm_body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR export_polish connect {e}"));
                "大模型润色请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;

        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR export_polish read body {e}"));
            "润色返回体读取失败。".to_string()
        })?;
        Ok::<_, String>((status, payload))
    };

    let http_result = if let Some((id, registration)) = cancel_registration {
        let out = Abortable::new(http_future, registration).await;
        if let Ok(mut handles) = cancel_state.0.lock() {
            handles.remove(&id);
        }
        match out {
            Ok(result) => result,
            Err(_) => {
                append_desktop_log_line(
                    &state,
                    &format!("INFO postprocess_export_polish_cancelled request_id={id}"),
                );
                return Err("大模型润色请求已取消。".to_string());
            }
        }
    } else {
        http_future.await
    }?;

    let (status, payload) = http_result;

    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!(
                "ERROR export_polish status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "润色服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(&state, &format!("ERROR export_polish invalid json {e}"));
        "润色返回格式无法解析。".to_string()
    })?;
    let raw = extract_chat_completion_text(&json)?;
    let parsed = postprocess_export_polish::parse_export_polish_json(&raw, line_count)?;
    if parsed.punct_lines.is_empty() {
        return Err("润色结果为空，请重试或取消勾选大模型润色。".to_string());
    }
    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_export_polish_done provider={} lines={} breaks={} latency_ms={latency_ms}",
            config.provider,
            parsed.punct_lines.len(),
            parsed.break_after_line.len()
        ),
    );

    Ok(PostprocessExportPolishResponse {
        punct_lines: parsed.punct_lines,
        break_after_line: parsed.break_after_line,
        provider: config.provider,
        latency_ms,
    })
}
