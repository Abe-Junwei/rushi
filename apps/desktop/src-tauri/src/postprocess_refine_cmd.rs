use crate::project::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde_json::json;
use std::time::Instant;
use tauri::State;

use super::{
    extract_chat_completion_text, resolve_postprocess_config_async,
    PostprocessAutoPunctuateRequest, PostprocessCancelState, PostprocessRefineSegmentsRequest,
    PostprocessRefineSegmentsResponse, DEFAULT_TIMEOUT_SECS,
};

#[tauri::command]
pub async fn postprocess_refine_segments(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessRefineSegmentsRequest,
) -> Result<PostprocessRefineSegmentsResponse, String> {
    if req.task.trim() != "refine_segments" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segments.is_empty() {
        return Err("缺少语段，无法整理段界。".to_string());
    }
    for s in &req.segments {
        if s.uid.trim().is_empty() || s.text.trim().is_empty() {
            return Err("每条语段须包含 uid 与非空正文。".to_string());
        }
    }

    let app_root = state.root.clone();
    let bridge_req = PostprocessAutoPunctuateRequest {
        task: "refine_segments".to_string(),
        request_id: req.request_id.clone(),
        segment_uid: req.segments[0].uid.clone(),
        text: String::new(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: req.runtime.clone(),
    };
    let config = resolve_postprocess_config_async(&bridge_req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt = super::postprocess_segment_ops::build_refine_segments_prompt(&req.segments);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写后处理助手。只输出 JSON 对象，包含 ops 与可选 rationale。"
            },
            { "role": "user", "content": prompt }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_refine_segments provider={} segment_count={}",
            config.provider,
            req.segments.len()
        ),
    );

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
            .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR postprocess refine connect {e}"));
                "段界整理请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;
        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess refine read body {e}"));
            "段界整理返回体读取失败。".to_string()
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
                    &format!("INFO postprocess_refine_segments_cancelled request_id={id}"),
                );
                return Err("段界整理请求已取消。".to_string());
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
                "ERROR postprocess refine status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "段界整理服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(
            &state,
            &format!("ERROR postprocess refine invalid json {e}"),
        );
        "段界整理返回格式无法解析。".to_string()
    })?;
    let raw_content = extract_chat_completion_text(&json)?;
    let parsed = super::postprocess_segment_ops::parse_refine_ops_json_lenient(&raw_content)?;
    super::postprocess_segment_ops::validate_refine_ops(&req.segments, &parsed.ops)?;

    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_refine_segments_done provider={} ops={} latency_ms={latency_ms}",
            config.provider,
            parsed.ops.len()
        ),
    );

    Ok(PostprocessRefineSegmentsResponse {
        ops: parsed.ops,
        rationale: parsed.rationale,
        provider: config.provider,
        latency_ms,
    })
}
