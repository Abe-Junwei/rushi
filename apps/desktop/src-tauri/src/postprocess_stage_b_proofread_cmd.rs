use crate::project::lexicon_pack::assemble_lexicon_pack;
use crate::project::utils::{append_desktop_log_line, open_db};
use crate::utils::{format_postprocess_connect_error, send_postprocess_chat_request};
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use serde_json::json;
use std::time::Instant;
use tauri::State;

use super::{
    chat_completion_finish_reason, extract_chat_completion_text_labeled,
    resolve_postprocess_config_async, PostprocessAutoPunctuateRequest, PostprocessCancelState,
    PostprocessStageBProofreadRequest, PostprocessStageBProofreadResponse, DEFAULT_TIMEOUT_SECS,
};

#[tauri::command]
pub async fn postprocess_stage_b_proofread(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessStageBProofreadRequest,
) -> Result<PostprocessStageBProofreadResponse, String> {
    if req.task.trim() != "stage_b_proofread" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segments.is_empty() {
        return Err("缺少语段，无法执行智能改稿。".to_string());
    }
    for s in &req.segments {
        if s.uid.trim().is_empty() || s.text.trim().is_empty() {
            return Err("每条语段须包含 uid 与非空正文。".to_string());
        }
    }

    let conn = open_db(&state)?;
    let pack = assemble_lexicon_pack(&conn)?;
    let pack_meta = pack.pack_meta.clone();

    let app_root = state.root.clone();
    let bridge_req = PostprocessAutoPunctuateRequest {
        task: "stage_b_proofread".to_string(),
        request_id: req.request_id.clone(),
        segment_uid: req.segments[0].uid.clone(),
        text: String::new(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: req.runtime.clone(),
    };
    let config = resolve_postprocess_config_async(&bridge_req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt_overrides = req.runtime.as_ref().and_then(|rt| rt.prompt_overrides.as_ref());
    let instructions_override = prompt_overrides
        .and_then(|o| o.stage_b_instructions.as_deref());
    let system_prompt = super::postprocess_lexicon_ops::resolve_stage_b_system_prompt(
        prompt_overrides.and_then(|o| o.stage_b_system.as_deref()),
    );
    let prompt = super::postprocess_lexicon_ops::build_stage_b_merged_proofread_prompt(
        &req.segments,
        &pack,
        instructions_override,
    );
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            { "role": "user", "content": prompt }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_stage_b_proofread provider={} segment_count={} glossary={} rules={}",
            config.provider,
            req.segments.len(),
            pack.glossary_canonical.len(),
            pack.correction_rules.len()
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
            append_desktop_log_line(&state, &format!("ERROR postprocess stage_b connect {e}"));
            format_postprocess_connect_error("智能改稿", &e, &endpoint)
        })?;
        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess stage_b read body {e}"));
            "智能改稿返回体读取失败。".to_string()
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
                    &format!("INFO postprocess_stage_b_proofread_cancelled request_id={id}"),
                );
                return Err("智能改稿请求已取消。".to_string());
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
                "ERROR postprocess stage_b status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "智能改稿服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(
            &state,
            &format!("ERROR postprocess stage_b invalid json {e}"),
        );
        "智能改稿返回格式无法解析。".to_string()
    })?;
    let raw_content = extract_chat_completion_text_labeled(&json, "智能改稿")?;
    let finish_reason = chat_completion_finish_reason(&json).unwrap_or("unknown");
    let parsed =
        super::postprocess_lexicon_ops::parse_lexicon_proofread_json_lenient(&raw_content)?;
    let parse_skipped = parsed.skipped_malformed_ops;
    let (items, mut warnings, mut drop_stats) =
        super::postprocess_lexicon_ops::filter_grounded_lexicon_ops(
            &pack,
            &req.segments,
            parsed.payload.ops,
        )?;
    drop_stats.parse_malformed += parse_skipped;
    if finish_reason == "length" {
        warnings
            .push("模型输出可能被截断（finish_reason=length），部分语段建议可能丢失。".to_string());
    }
    if parse_skipped > 0 {
        warnings.push(format!("跳过 {parse_skipped} 条结构不完整的 LLM 建议"));
    }
    let dropped_ops = drop_stats.ignored_for_ui();
    if dropped_ops > 0 || drop_stats.unchanged > 0 {
        append_desktop_log_line(
            &state,
            &format!(
                "WARN postprocess_stage_b_proofread dropped_ops={dropped_ops} unchanged={} ungrounded={} mismatch={} parse_malformed={} llm_homophone={}",
                drop_stats.unchanged,
                drop_stats.ungrounded,
                drop_stats.evidence_mismatch,
                drop_stats.parse_malformed,
                drop_stats.llm_homophone,
            ),
        );
    }
    let ops: Vec<super::postprocess_segment_ops::SegmentRefineOp> = items
        .iter()
        .map(
            |g| super::postprocess_segment_ops::SegmentRefineOp::UpdateText {
                uid: g.uid.clone(),
                text: g.text.clone(),
            },
        )
        .collect();

    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_stage_b_proofread_done provider={} ops={} latency_ms={latency_ms}",
            config.provider,
            ops.len()
        ),
    );

    Ok(PostprocessStageBProofreadResponse {
        ops,
        items,
        warnings,
        dropped_ops,
        drop_stats,
        rationale: parsed.payload.rationale,
        pack_meta,
        provider: config.provider,
        latency_ms,
    })
}
