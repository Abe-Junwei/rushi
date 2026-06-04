//! Gate local FunASR transcribe on loopback /health + hub model alignment (R3-STATE).

use crate::asr_sidecar::is_rushi_asr_health_json;
use crate::asr_sidecar::loopback_root_declares_transcribe_async;
use crate::DbState;
use serde_json::Value;

pub fn local_transcribe_gate_from_root_catalog(root: &Value) -> Result<(), String> {
    if !loopback_root_declares_transcribe_async(root) {
        return Err(
            "侧车版本过旧，不支持增量转写（缺少 POST /v1/transcribe/async）。\
             请在环境页「应用并重启侧车」，或执行 npm run asr:build-sidecar-unix 重建 bundled 侧车。"
                .to_string(),
        );
    }
    Ok(())
}

pub fn local_transcribe_gate_from_health(
    health: &Value,
    hub_pref: Option<&str>,
) -> Result<(), String> {
    if !is_rushi_asr_health_json(health) {
        return Err("本机 ASR 未就绪：8741 上的服务不是 rushi-asr。".to_string());
    }
    let mode = health
        .get("transcription_mode")
        .and_then(|m| m.as_str())
        .unwrap_or("stub");
    if mode != "funasr" {
        return Err(
            "本机 ASR 仍为占位引擎（stub），无法正式转写。请在环境页完成模型准备后再试。"
                .to_string(),
        );
    }
    if health.get("ffmpeg_ok").and_then(|x| x.as_bool()) != Some(true) {
        return Err(
            "未检测到 FFmpeg，无法解码上传音频。请安装 ffmpeg/ffprobe 并加入 PATH 后重启侧车。"
                .to_string(),
        );
    }
    if health.get("ready_for_transcribe").and_then(|x| x.as_bool()) != Some(true) {
        return Err(
            "本机 ASR 模型尚未就绪：请在环境页下载当前所选模型并完成侧车准备。".to_string(),
        );
    }
    let sidecar_model = health
        .get("funasr_model_id")
        .and_then(|x| x.as_str())
        .unwrap_or("");
    if let Some(pref) = hub_pref.map(str::trim).filter(|s| !s.is_empty()) {
        let pref_norm = crate::local_asr_model::normalize_hub_model_id(pref);
        let sidecar_norm = crate::local_asr_model::normalize_hub_model_id(sidecar_model);
        if sidecar_norm != pref_norm {
            return Err(format!(
                "侧车当前模型（{sidecar_model}）与所选模型（{pref}）不一致；请先在环境页「应用并重启侧车」。"
            ));
        }
    }
    if let Some(loaded) = health
        .get("funasr_loaded_model_id")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
    {
        if !sidecar_model.is_empty() && loaded != sidecar_model {
            return Err(
                "侧车正在切换模型权重，请稍候或在环境页重新「应用并重启侧车」后再转写。"
                    .to_string(),
            );
        }
    }
    Ok(())
}

pub async fn assert_local_asr_ready_for_transcribe(
    st: &DbState,
    asr_base_url: &str,
) -> Result<(), String> {
    let base = asr_base_url.trim_end_matches('/');
    let health_url = format!("{base}/health");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&health_url)
        .send()
        .await
        .map_err(|_| "无法连接本机 ASR（8741）。请确认侧车已启动。".to_string())?;
    if !resp.status().is_success() {
        return Err(format!(
            "本机 ASR /health 返回 HTTP {}，无法开始转写。",
            resp.status().as_u16()
        ));
    }
    let text = resp
        .text()
        .await
        .map_err(|_| "读取本机 ASR /health 失败。".to_string())?;
    let health: Value = serde_json::from_str(&text)
        .map_err(|_| "本机 ASR /health 响应不是有效 JSON。".to_string())?;
    let hub_pref = crate::local_asr_model::read_hub_model_pref(st);
    local_transcribe_gate_from_health(&health, hub_pref.as_deref())?;

    let root_url = format!("{base}/");
    let root_resp = client
        .get(&root_url)
        .send()
        .await
        .map_err(|_| "无法读取本机 ASR 服务目录（GET /）。".to_string())?;
    if !root_resp.status().is_success() {
        return Err(format!(
            "本机 ASR GET / 返回 HTTP {}，无法确认增量转写能力。",
            root_resp.status().as_u16()
        ));
    }
    let root_text = root_resp
        .text()
        .await
        .map_err(|_| "读取本机 ASR GET / 失败。".to_string())?;
    let root: Value = serde_json::from_str(&root_text)
        .map_err(|_| "本机 ASR GET / 响应不是有效 JSON。".to_string())?;
    local_transcribe_gate_from_root_catalog(&root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ok_health(model: &str) -> Value {
        json!({
            "service": "rushi-asr",
            "status": "ok",
            "transcription_mode": "funasr",
            "ready_for_transcribe": true,
            "ffmpeg_ok": true,
            "funasr_model_id": model,
            "funasr_loaded_model_id": model,
        })
    }

    const PARA: &str =
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";

    #[test]
    fn gate_passes_when_hub_matches_sidecar() {
        local_transcribe_gate_from_health(&ok_health(PARA), Some(PARA)).unwrap();
    }

    #[test]
    fn gate_passes_when_deprecated_pref_matches_paraformer_sidecar() {
        local_transcribe_gate_from_health(&ok_health(PARA), Some("iic/SenseVoiceSmall")).unwrap();
    }

    #[test]
    fn gate_blocks_stub_mode() {
        let mut health = ok_health(PARA);
        health["transcription_mode"] = json!("stub");
        assert!(local_transcribe_gate_from_health(&health, None).is_err());
    }

    #[test]
    fn gate_blocks_hub_mismatch() {
        assert!(local_transcribe_gate_from_health(
            &ok_health(PARA),
            Some("Qwen/Qwen3-ASR-0.6B"),
        )
        .is_err());
    }

    #[test]
    fn gate_blocks_loaded_memory_mismatch() {
        let mut health = ok_health(PARA);
        health["funasr_loaded_model_id"] = json!("Qwen/Qwen3-ASR-0.6B");
        assert!(local_transcribe_gate_from_health(&health, Some(PARA)).is_err());
    }

    #[test]
    fn gate_blocks_when_ffmpeg_missing() {
        let mut health = ok_health(PARA);
        health["ffmpeg_ok"] = json!(false);
        health["ready_for_transcribe"] = json!(false);
        let err = local_transcribe_gate_from_health(&health, Some(PARA)).unwrap_err();
        assert!(err.contains("FFmpeg"));
    }

    #[test]
    fn gate_blocks_stale_sidecar_without_async_transcribe() {
        let root = json!({
            "service": "rushi-asr",
            "transcribe": "POST /v1/transcribe",
        });
        assert!(local_transcribe_gate_from_root_catalog(&root).is_err());
    }

    #[test]
    fn gate_passes_when_async_transcribe_declared() {
        let root = json!({
            "transcribe_async": "POST /v1/transcribe/async + GET /v1/transcribe/status",
        });
        local_transcribe_gate_from_root_catalog(&root).unwrap();
    }
}
