//! 交付导出大模型润色 Tauri 命令（HTTP + 可取消；长稿自动分批）。

use crate::project::utils::append_desktop_log_line;
use crate::utils::{
    export_polish_max_tokens, export_polish_timeout_secs, format_postprocess_transport_error,
    is_loopback_endpoint, postprocess_async_client,
};
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;
use tauri::State;
use url::Url;

use super::postprocess_export_polish::{self, ExportPolishParsed};
use super::{
    chat_completion_finish_reason, extract_chat_completion_text,
    resolve_runtime_postprocess_config, PostprocessCancelState, PostprocessPromptOverrides,
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

struct ExportPolishLlmConfig {
    provider: String,
    endpoint: Url,
    api_key: String,
    model: String,
    loopback: bool,
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

    let rule_hints = req.rule_hints.as_deref().map(str::trim).unwrap_or("");
    let prompt_overrides = req.runtime.prompt_overrides.clone();
    if let Some(template) = prompt_overrides
        .as_ref()
        .and_then(|o| o.export_polish_instructions.as_deref())
    {
        postprocess_export_polish::validate_export_polish_instructions_template(template)?;
    }
    let loopback = is_loopback_endpoint(&config.endpoint);
    let llm_cfg = ExportPolishLlmConfig {
        provider: config.provider.clone(),
        endpoint: config.endpoint.clone(),
        api_key: config.api_key.clone(),
        model: config.model.clone(),
        loopback,
    };

    let batch_bodies = postprocess_export_polish::plan_export_polish_batch_bodies(body);
    if batch_bodies.is_empty() {
        return Err("正文为空，无法润色。".to_string());
    }
    let batch_line_counts: Vec<usize> = batch_bodies
        .iter()
        .map(|b| postprocess_export_polish::count_body_lines(b))
        .collect();
    let total_lines: usize = batch_line_counts.iter().sum();
    let batch_total = batch_bodies.len();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_export_polish provider={} chars={} lines={total_lines} batches={batch_total}",
            llm_cfg.provider,
            body.chars().count(),
        ),
    );

    let t0 = Instant::now();
    let mut parsed_parts = Vec::with_capacity(batch_total);
    let mut batch_latencies = Vec::with_capacity(batch_total);

    for (batch_idx, batch_body) in batch_bodies.iter().enumerate() {
        let batch_no = batch_idx + 1;
        let batch_lines = batch_line_counts[batch_idx];
        let batch_note = if batch_total > 1 {
            Some((batch_no, batch_total))
        } else {
            None
        };
        append_desktop_log_line(
            &state,
            &format!("INFO export_polish_batch {batch_no}/{batch_total} lines={batch_lines}"),
        );
        let (parsed, batch_ms) = run_export_polish_batch(
            &state,
            &cancel_state,
            &llm_cfg,
            batch_body,
            batch_lines,
            rule_hints,
            batch_note,
            request_id.as_deref(),
            prompt_overrides.as_ref(),
        )
        .await?;
        batch_latencies.push(batch_ms);
        parsed_parts.push(parsed);
    }

    let parsed = if batch_total > 1 {
        postprocess_export_polish::merge_export_polish_batches(parsed_parts, &batch_line_counts)
    } else {
        parsed_parts
            .into_iter()
            .next()
            .ok_or_else(|| "润色结果为空。".to_string())?
    };

    if parsed.punct_lines.is_empty() {
        return Err("润色结果为空，请重试或取消勾选大模型润色。".to_string());
    }

    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_export_polish_done provider={} lines={} breaks={} batches={batch_total} batch_latency_ms={batch_latencies:?} latency_ms={latency_ms}",
            llm_cfg.provider,
            parsed.punct_lines.len(),
            parsed.break_after_line.len(),
        ),
    );

    Ok(PostprocessExportPolishResponse {
        punct_lines: parsed.punct_lines,
        break_after_line: parsed.break_after_line,
        provider: llm_cfg.provider,
        latency_ms,
    })
}

#[allow(clippy::too_many_arguments)]
async fn run_export_polish_batch(
    state: &DbState,
    cancel_state: &PostprocessCancelState,
    cfg: &ExportPolishLlmConfig,
    batch_body: &str,
    line_count: usize,
    rule_hints: &str,
    batch_note: Option<(usize, usize)>,
    request_id: Option<&str>,
    prompt_overrides: Option<&PostprocessPromptOverrides>,
) -> Result<(ExportPolishParsed, u64), String> {
    let system_prompt = postprocess_export_polish::resolve_export_polish_system_prompt(
        prompt_overrides.and_then(|o| o.export_polish_system.as_deref()),
    );
    let instructions_override =
        prompt_overrides.and_then(|o| o.export_polish_instructions.as_deref());
    let prompt = postprocess_export_polish::build_export_polish_prompt(
        batch_body,
        line_count,
        rule_hints,
        batch_note,
        instructions_override,
    );
    let char_count = batch_body.chars().count();
    let mut llm_body = json!({
        "model": cfg.model,
        "temperature": 0.35,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    });
    if cfg.loopback {
        if let Some(obj) = llm_body.as_object_mut() {
            obj.insert("format".to_string(), json!("json"));
        }
    }
    let max_tokens = export_polish_max_tokens(line_count, char_count);
    if let Some(obj) = llm_body.as_object_mut() {
        obj.insert("max_tokens".to_string(), json!(max_tokens));
    }

    let timeout_secs = export_polish_timeout_secs(char_count, cfg.loopback);
    let http = postprocess_async_client(cfg.loopback);
    let t0 = Instant::now();

    let cancel_registration = request_id.map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.to_string(), handle) {
                previous.abort();
            }
        }
        (id.to_string(), registration)
    });

    let log_state = state.clone();
    let endpoint = cfg.endpoint.clone();
    let api_key = cfg.api_key.clone();
    let loopback = cfg.loopback;
    let http_future = async move {
        let resp = http
            .post(endpoint)
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .json(&llm_body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(
                    &log_state,
                    &format!(
                        "ERROR export_polish transport loopback={loopback} timeout_secs={timeout_secs} {e}"
                    ),
                );
                format_postprocess_transport_error(&e, loopback, "大模型润色")
            })?;

        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&log_state, &format!("ERROR export_polish read body {e}"));
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
                    state,
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
            state,
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
        append_desktop_log_line(state, &format!("ERROR export_polish invalid json {e}"));
        "润色返回格式无法解析。".to_string()
    })?;
    let raw = extract_chat_completion_text(&json)?;
    let finish_reason = chat_completion_finish_reason(&json).unwrap_or("unknown");
    let parsed = postprocess_export_polish::parse_export_polish_json(&raw, line_count).map_err(|e| {
        let truncated = finish_reason == "length";
        let open_braces = raw.matches('{').count();
        let close_braces = raw.matches('}').count();
        append_desktop_log_line(
            state,
            &format!(
                "ERROR export_polish parse_json line_count={line_count} finish_reason={finish_reason} raw_len={} braces={open_braces}/{close_braces} err={e} snippet={}",
                raw.chars().count(),
                crate::utils::redact_http_body_snippet(&raw)
            ),
        );
        if truncated {
            format!(
                "{e} 模型输出被截断（finish_reason=length，max_tokens={max_tokens}），请换更小批次模型或改用云端 LLM。"
            )
        } else {
            e
        }
    })?;
    if parsed.punct_lines.is_empty() {
        return Err("润色结果为空，请重试或取消勾选大模型润色。".to_string());
    }

    Ok((parsed, t0.elapsed().as_millis() as u64))
}
