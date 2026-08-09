//! 交付导出大模型润色 Tauri 命令（HTTP + 可取消；长稿自动分批；截断/解析失败可拆批重试）。

use crate::project::utils::append_desktop_log_line;
use crate::utils::{
    export_polish_max_tokens, export_polish_timeout_secs, format_postprocess_transport_error,
    is_loopback_endpoint, postprocess_async_client,
};
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use url::Url;

use super::postprocess_export_polish::{self, ExportPolishParsed, ExportPolishProtocolStats};
use super::{
    chat_completion_finish_reason, extract_chat_completion_text,
    resolve_runtime_postprocess_config, PostprocessCancelState, PostprocessPromptOverrides,
    PostprocessRuntimeBridge,
};

const EXPORT_POLISH_PROGRESS_EVENT: &str = "export-polish-progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPolishProgressPayload {
    batch: usize,
    total: usize,
}

fn emit_export_polish_progress(app: &AppHandle, batch: usize, total: usize) {
    let _ = app.emit(
        EXPORT_POLISH_PROGRESS_EVENT,
        ExportPolishProgressPayload { batch, total },
    );
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessExportPolishRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub body: String,
    #[serde(default)]
    pub line_count: Option<usize>,
    /// 讲稿优化使用的导出快照稳定键；与正文行一一对应。
    #[serde(default)]
    pub line_uids: Option<Vec<String>>,
    pub runtime: PostprocessRuntimeBridge,
    /// 稳定纠错规则摘要，注入 prompt（可选）。
    #[serde(default)]
    pub rule_hints: Option<String>,
    /// 词表 canonical 摘要，注入 prompt（可选）。
    #[serde(default)]
    pub glossary_hints: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessExportPolishResponse {
    pub punct_lines: Vec<String>,
    pub content_contract_valid: bool,
    pub contract_fallback_line_indices: Vec<usize>,
    pub break_after_line: Vec<usize>,
    pub protocol_stats: ExportPolishProtocolStats,
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
    app: AppHandle,
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessExportPolishRequest,
) -> Result<PostprocessExportPolishResponse, String> {
    let task = req.task.trim();
    if task != "export_polish" && task != "lecture_paragraphs" && task != "export_lecture_optimize"
    {
        return Err("暂不支持该后处理任务。".to_string());
    }
    let lecture_optimize = task == "export_lecture_optimize";
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
    let glossary_hints = req.glossary_hints.as_deref().map(str::trim).unwrap_or("");
    let prompt_overrides = req.runtime.prompt_overrides.clone();
    if !lecture_optimize {
        if let Some(template) = prompt_overrides
            .as_ref()
            .and_then(|o| o.export_polish_instructions.as_deref())
        {
            postprocess_export_polish::validate_export_polish_instructions_template(template)?;
        }
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
    let parsed_line_count = postprocess_export_polish::lines_from_export_polish_body(body).len();
    let total_lines = req
        .line_count
        .filter(|&n| n > 0)
        .unwrap_or(parsed_line_count);
    if req.line_count.is_some() && parsed_line_count != total_lines {
        return Err(format!(
            "语段行数不一致（声明 {total_lines} 行 / 正文解析 {parsed_line_count} 行），请重新打开导出对话框。"
        ));
    }
    let line_uids = if lecture_optimize {
        let uids = req.line_uids.clone().unwrap_or_else(|| {
            (0..total_lines)
                .map(|index| format!("export-snapshot-{index}"))
                .collect()
        });
        let unique: HashSet<&str> = uids
            .iter()
            .map(|uid| uid.trim())
            .filter(|uid| !uid.is_empty())
            .collect();
        if uids.len() != total_lines || unique.len() != total_lines {
            return Err("讲稿优化稳定 uid 与正文行不一致、为空或重复。".to_string());
        }
        uids.into_iter().map(|uid| uid.trim().to_string()).collect()
    } else {
        Vec::new()
    };
    let batch_line_counts: Vec<usize> = batch_bodies
        .iter()
        .map(|b| postprocess_export_polish::count_body_lines(b))
        .collect();
    if batch_line_counts.iter().sum::<usize>() != total_lines {
        return Err("润色分批计数异常，请重试。".to_string());
    }
    let mut uid_offset = 0usize;
    let batch_line_uids: Vec<Vec<String>> = batch_line_counts
        .iter()
        .map(|&count| {
            let end = uid_offset + count;
            let chunk = if lecture_optimize {
                line_uids[uid_offset..end].to_vec()
            } else {
                Vec::new()
            };
            uid_offset = end;
            chunk
        })
        .collect();
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
        emit_export_polish_progress(&app, batch_no, batch_total);
        append_desktop_log_line(
            &state,
            &format!("INFO export_polish_batch {batch_no}/{batch_total} lines={batch_lines}"),
        );
        let (parsed, batch_ms) = run_export_polish_batch(
            &state,
            &cancel_state,
            &llm_cfg,
            batch_body,
            &batch_line_uids[batch_idx],
            batch_lines,
            rule_hints,
            glossary_hints,
            batch_note,
            request_id.as_deref(),
            prompt_overrides.as_ref(),
            lecture_optimize,
        )
        .await?;
        if !parsed.content_contract_valid || parsed.protocol_stats.invalid_edits > 0 {
            append_desktop_log_line(
                &state,
                &format!(
                    "WARN export_polish_batch_contract_fallback batch={batch_no}/{batch_total} lines={batch_lines} fallback_lines={} invalid_edits={} unknown_uids={} duplicate_uids={} empty_edits={} malformed_edits={} context_echo_edits={}",
                    parsed.contract_fallback_line_indices.len(),
                    parsed.protocol_stats.invalid_edits,
                    parsed.protocol_stats.unknown_uids,
                    parsed.protocol_stats.duplicate_uids,
                    parsed.protocol_stats.empty_edits,
                    parsed.protocol_stats.malformed_edits,
                    parsed.protocol_stats.context_echo_edits,
                ),
            );
        }
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
            "INFO postprocess_export_polish_done provider={} lines={} breaks={} content_contract_valid={} contract_fallback_lines={} omitted_unchanged={} invalid_edits={} context_echo_edits={} retried_edits={} recovered_edits={} legacy_response={} batches={batch_total} batch_latency_ms={batch_latencies:?} latency_ms={latency_ms}",
            llm_cfg.provider,
            parsed.punct_lines.len(),
            parsed.break_after_line.len(),
            parsed.content_contract_valid,
            parsed.contract_fallback_line_indices.len(),
            parsed.protocol_stats.omitted_unchanged,
            parsed.protocol_stats.invalid_edits,
            parsed.protocol_stats.context_echo_edits,
            parsed.protocol_stats.retried_edits,
            parsed.protocol_stats.recovered_edits,
            parsed.protocol_stats.legacy_response,
        ),
    );

    Ok(PostprocessExportPolishResponse {
        punct_lines: parsed.punct_lines,
        content_contract_valid: parsed.content_contract_valid,
        contract_fallback_line_indices: parsed.contract_fallback_line_indices,
        break_after_line: parsed.break_after_line,
        protocol_stats: parsed.protocol_stats,
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
    line_uids: &[String],
    line_count: usize,
    rule_hints: &str,
    glossary_hints: &str,
    batch_note: Option<(usize, usize)>,
    request_id: Option<&str>,
    prompt_overrides: Option<&PostprocessPromptOverrides>,
    lecture_optimize: bool,
) -> Result<(ExportPolishParsed, u64), String> {
    let mut first_result = run_export_polish_batch_once(
        state,
        cancel_state,
        cfg,
        batch_body,
        line_uids,
        line_count,
        rule_hints,
        glossary_hints,
        batch_note,
        request_id,
        prompt_overrides,
        0.15,
        true,
        lecture_optimize,
    )
    .await;
    let sparse_retry_indices = match &first_result {
        Ok((parsed, _)) if parsed.protocol_stats.sparse_response => {
            parsed.contract_fallback_line_indices.clone()
        }
        _ => Vec::new(),
    };
    if !sparse_retry_indices.is_empty() {
        let input_lines = postprocess_export_polish::lines_from_export_polish_body(batch_body);
        let retry_lines: Vec<String> = sparse_retry_indices
            .iter()
            .filter_map(|&index| input_lines.get(index).cloned())
            .collect();
        let retry_uids: Vec<String> = sparse_retry_indices
            .iter()
            .filter_map(|&index| line_uids.get(index).cloned())
            .collect();
        if retry_lines.len() == sparse_retry_indices.len()
            && retry_uids.len() == sparse_retry_indices.len()
        {
            let retry_body = retry_lines
                .join(&postprocess_export_polish::EXPORT_POLISH_LINE_SEPARATOR.to_string());
            append_desktop_log_line(
                state,
                &format!(
                    "WARN export_lecture_optimize_retry_invalid_edits count={}",
                    sparse_retry_indices.len()
                ),
            );
            if let Ok((retry, retry_ms)) = run_export_polish_batch_once(
                state,
                cancel_state,
                cfg,
                &retry_body,
                &retry_uids,
                retry_lines.len(),
                rule_hints,
                glossary_hints,
                batch_note,
                request_id,
                prompt_overrides,
                0.05,
                true,
                lecture_optimize,
            )
            .await
            {
                if let Ok((parsed, first_ms)) = &mut first_result {
                    let retry_fallback: HashSet<usize> = retry
                        .contract_fallback_line_indices
                        .iter()
                        .copied()
                        .collect();
                    let mut unresolved = Vec::new();
                    let mut recovered = 0usize;
                    for (retry_index, &original_index) in sparse_retry_indices.iter().enumerate() {
                        if retry_fallback.contains(&retry_index) {
                            unresolved.push(original_index);
                        } else if let Some(text) = retry.punct_lines.get(retry_index) {
                            if postprocess_export_polish::export_lecture_edit_has_context_echo(
                                original_index,
                                text,
                                &input_lines,
                            ) {
                                parsed.protocol_stats.context_echo_edits += 1;
                                unresolved.push(original_index);
                            } else {
                                parsed.punct_lines[original_index] = text.clone();
                                recovered += 1;
                            }
                        } else {
                            unresolved.push(original_index);
                        }
                    }
                    parsed.contract_fallback_line_indices = unresolved;
                    parsed.protocol_stats.retried_edits += sparse_retry_indices.len();
                    parsed.protocol_stats.recovered_edits += recovered;
                    *first_ms = first_ms.saturating_add(retry_ms);
                }
            }
        }
    }
    let (first_err, first_contract_fallback) = match first_result {
        Ok(ok) if ok.0.content_contract_valid => return Ok(ok),
        Ok(ok) => (
            format!(
                "模型输出未通过内容契约（本批应完整返回 {line_count} 个唯一 ID，需回退 {} 行）。",
                ok.0.contract_fallback_line_indices.len()
            ),
            Some(ok),
        ),
        Err(err) => (err, None),
    };
    if !postprocess_export_polish::export_polish_error_is_retriable(&first_err) {
        return match first_contract_fallback {
            Some(fallback) => Ok(fallback),
            None => Err(first_err),
        };
    }

    // 优先对半拆批，降低 JSON 截断和 ID 契约异常概率。
    if postprocess_export_polish::should_split_export_polish_retry(
        line_count,
        first_contract_fallback.is_some(),
    ) {
        if let Some((left, right)) =
            postprocess_export_polish::split_export_polish_batch_body(batch_body)
        {
            let left_n = postprocess_export_polish::count_body_lines(&left);
            let right_n = postprocess_export_polish::count_body_lines(&right);
            let (left_uids, right_uids) = if lecture_optimize {
                line_uids.split_at(left_n)
            } else {
                (&[][..], &[][..])
            };
            append_desktop_log_line(
                state,
                &format!(
                    "WARN export_polish_retry_split lines={line_count} -> {left_n}+{right_n} cause={}",
                    crate::utils::redact_http_body_snippet(&first_err)
                ),
            );
            let (p0, t0) = Box::pin(run_export_polish_batch(
                state,
                cancel_state,
                cfg,
                &left,
                left_uids,
                left_n,
                rule_hints,
                glossary_hints,
                batch_note,
                request_id,
                prompt_overrides,
                lecture_optimize,
            ))
            .await?;
            let (p1, t1) = Box::pin(run_export_polish_batch(
                state,
                cancel_state,
                cfg,
                &right,
                right_uids,
                right_n,
                rule_hints,
                glossary_hints,
                batch_note,
                request_id,
                prompt_overrides,
                lecture_optimize,
            ))
            .await?;
            let merged = postprocess_export_polish::merge_export_polish_batches(
                vec![p0, p1],
                &[left_n, right_n],
            );
            return Ok((merged, t0.saturating_add(t1)));
        }
    }

    append_desktop_log_line(
        state,
        &format!(
            "WARN export_polish_retry_cold lines={line_count} cause={}",
            crate::utils::redact_http_body_snippet(&first_err)
        ),
    );
    match run_export_polish_batch_once(
        state,
        cancel_state,
        cfg,
        batch_body,
        line_uids,
        line_count,
        rule_hints,
        glossary_hints,
        batch_note,
        request_id,
        prompt_overrides,
        0.05,
        true,
        lecture_optimize,
    )
    .await
    {
        Ok(ok) if ok.0.content_contract_valid => Ok(ok),
        Ok(fallback) => {
            append_desktop_log_line(
                state,
                &format!(
                    "WARN export_polish_contract_fallback lines={line_count} after_retry=true"
                ),
            );
            Ok(fallback)
        }
        Err(retry_err) => match first_contract_fallback {
            Some(fallback) => {
                append_desktop_log_line(
                    state,
                    &format!(
                        "WARN export_polish_contract_fallback lines={line_count} after_retry_error={} ",
                        crate::utils::redact_http_body_snippet(&retry_err)
                    ),
                );
                Ok(fallback)
            }
            None => Err(format!(
                "{retry_err}（已自动重试仍失败；首次：{}）",
                truncate_err(&first_err)
            )),
        },
    }
}

fn truncate_err(err: &str) -> String {
    let t: String = err.chars().take(160).collect();
    if err.chars().count() > 160 {
        format!("{t}…")
    } else {
        t
    }
}

fn apply_export_polish_json_mode(llm_body: &mut serde_json::Value, loopback: bool, enable: bool) {
    if !enable {
        return;
    }
    let Some(obj) = llm_body.as_object_mut() else {
        return;
    };
    if loopback {
        obj.insert("format".to_string(), json!("json"));
    } else {
        obj.insert(
            "response_format".to_string(),
            json!({ "type": "json_object" }),
        );
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_export_polish_batch_once(
    state: &DbState,
    cancel_state: &PostprocessCancelState,
    cfg: &ExportPolishLlmConfig,
    batch_body: &str,
    line_uids: &[String],
    line_count: usize,
    rule_hints: &str,
    glossary_hints: &str,
    batch_note: Option<(usize, usize)>,
    request_id: Option<&str>,
    prompt_overrides: Option<&PostprocessPromptOverrides>,
    temperature: f64,
    use_json_mode: bool,
    lecture_optimize: bool,
) -> Result<(ExportPolishParsed, u64), String> {
    let (system_prompt, prompt) = if lecture_optimize {
        (
            postprocess_export_polish::resolve_export_lecture_optimize_system_prompt(),
            postprocess_export_polish::build_export_lecture_optimize_prompt(
                batch_body,
                line_uids,
                rule_hints,
                glossary_hints,
                batch_note,
            ),
        )
    } else {
        let system = postprocess_export_polish::resolve_export_polish_system_prompt(
            prompt_overrides.and_then(|o| o.export_polish_system.as_deref()),
        );
        let instructions_override =
            prompt_overrides.and_then(|o| o.export_polish_instructions.as_deref());
        let user = postprocess_export_polish::build_export_polish_prompt(
            batch_body,
            line_count,
            rule_hints,
            glossary_hints,
            batch_note,
            instructions_override,
        );
        (system, user)
    };
    let char_count = batch_body.chars().count();
    let mut llm_body = json!({
        "model": cfg.model,
        "temperature": temperature,
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
    apply_export_polish_json_mode(&mut llm_body, cfg.loopback, use_json_mode);
    let max_tokens = export_polish_max_tokens(line_count, char_count);
    if let Some(obj) = llm_body.as_object_mut() {
        obj.insert("max_tokens".to_string(), json!(max_tokens));
    }

    let timeout_secs = export_polish_timeout_secs(char_count, cfg.loopback);
    let t0 = Instant::now();

    let (status, payload) = send_export_polish_http(
        state,
        cancel_state,
        cfg,
        &llm_body,
        timeout_secs,
        request_id,
    )
    .await?;

    // 部分云端不认 response_format：400 时降级再试一次。
    let (status, payload) =
        if !status.is_success() && !cfg.loopback && use_json_mode && status.as_u16() == 400 {
            append_desktop_log_line(
                state,
                "WARN export_polish response_format unsupported; retry without json mode",
            );
            let mut fallback_body = llm_body.clone();
            if let Some(obj) = fallback_body.as_object_mut() {
                obj.remove("response_format");
            }
            send_export_polish_http(
                state,
                cancel_state,
                cfg,
                &fallback_body,
                timeout_secs,
                request_id,
            )
            .await?
        } else {
            (status, payload)
        };

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
    let parsed_result = if lecture_optimize {
        let input_lines = postprocess_export_polish::lines_from_export_polish_body(batch_body);
        postprocess_export_polish::parse_export_lecture_optimize_json(&raw, line_uids, &input_lines)
    } else {
        postprocess_export_polish::parse_export_polish_json(&raw, line_count)
    };
    let mut parsed = parsed_result.map_err(|e| {
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
                    "{e} 模型输出被截断（finish_reason=length，max_tokens={max_tokens}），请缩小导出范围或改用云端 LLM。"
                )
            } else {
                e
            }
        })?;
    postprocess_export_polish::fallback_invalid_batch_to_originals(&mut parsed, batch_body);

    Ok((parsed, t0.elapsed().as_millis() as u64))
}

async fn send_export_polish_http(
    state: &DbState,
    cancel_state: &PostprocessCancelState,
    cfg: &ExportPolishLlmConfig,
    llm_body: &serde_json::Value,
    timeout_secs: u64,
    request_id: Option<&str>,
) -> Result<(reqwest::StatusCode, String), String> {
    let http = postprocess_async_client(cfg.loopback);
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
    let body = llm_body.clone();
    let http_future = async move {
        let resp = http
            .post(endpoint)
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .json(&body)
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

    if let Some((id, registration)) = cancel_registration {
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
                Err("大模型润色请求已取消。".to_string())
            }
        }
    } else {
        http_future.await
    }
}
