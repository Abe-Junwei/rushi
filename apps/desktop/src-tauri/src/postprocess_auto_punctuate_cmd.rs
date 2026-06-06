use crate::project::utils::append_desktop_log_line;
use crate::utils::{format_postprocess_connect_error, send_postprocess_chat_request};
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde_json::json;
use std::time::Instant;
use tauri::State;

use super::{
    build_auto_punctuate_prompt, extract_chat_completion_text, resolve_postprocess_config_async,
    PostprocessAutoPunctuateRawResponse, PostprocessAutoPunctuateRequest, PostprocessCancelState,
    DEFAULT_TIMEOUT_SECS,
};

#[tauri::command]
pub async fn postprocess_auto_punctuate(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessAutoPunctuateRequest,
) -> Result<PostprocessAutoPunctuateRawResponse, String> {
    if req.task.trim() != "auto_punctuate" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segment_uid.trim().is_empty() {
        return Err("缺少语段 uid，无法执行自动标点。".to_string());
    }
    let text = req.text.trim();
    if text.is_empty() {
        return Err("当前语段正文为空，无法执行自动标点。".to_string());
    }

    let app_root = state.root.clone();
    let config = resolve_postprocess_config_async(&req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt = build_auto_punctuate_prompt(text, &req.neighbor_context, &req.neighbor_snippets);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写后处理助手。只给当前语段补充自然、克制的中文标点，不改写词语，不补充解释，不输出 markdown，不返回额外说明。"
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
            "INFO postprocess_auto_punctuate provider={} segment_uid={}",
            config.provider, req.segment_uid
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
        let endpoint = config.endpoint.clone();
        let resp = send_postprocess_chat_request(
            &endpoint,
            &api_key,
            &body,
            std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS),
        )
        .await
        .map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess connect {e}"));
            format_postprocess_connect_error("自动标点", &e, &endpoint)
        })?;

        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess read body {e}"));
            "自动标点返回体读取失败。".to_string()
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
                    &format!("INFO postprocess_auto_punctuate_cancelled request_id={id}"),
                );
                return Err("自动标点请求已取消。".to_string());
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
                "ERROR postprocess status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "自动标点服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(&state, &format!("ERROR postprocess invalid json {e}"));
        "自动标点返回格式无法解析。".to_string()
    })?;
    let candidate = extract_chat_completion_text(&json)?;
    let latency_ms = t0.elapsed().as_millis() as u64;

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_auto_punctuate_done provider={} latency_ms={latency_ms}",
            config.provider
        ),
    );

    Ok(PostprocessAutoPunctuateRawResponse {
        text: candidate,
        provider: config.provider,
        latency_ms,
    })
}
