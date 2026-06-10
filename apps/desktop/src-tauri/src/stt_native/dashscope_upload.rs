//! 百炼临时 OSS 上传（`GET /api/v1/uploads?action=getPolicy` → POST upload_host）。

use std::path::Path;

use serde_json::Value;

use super::{read_audio_bytes_limited, send_stt_cloud_get, send_stt_cloud_post};

pub const DASHSCOPE_UPLOADS_URL: &str = "https://dashscope.aliyuncs.com/api/v1/uploads";

fn build_oss_upload_form(
    policy: &Value,
    key: &str,
    file_name: &str,
    bytes: Vec<u8>,
) -> reqwest::multipart::Form {
    reqwest::multipart::Form::new()
        .text(
            "OSSAccessKeyId",
            policy
                .get("oss_access_key_id")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
        )
        .text(
            "Signature",
            policy
                .get("signature")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
        )
        .text(
            "policy",
            policy
                .get("policy")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
        )
        .text(
            "x-oss-object-acl",
            policy
                .get("x_oss_object_acl")
                .and_then(|x| x.as_str())
                .unwrap_or("private")
                .to_string(),
        )
        .text(
            "x-oss-forbid-overwrite",
            policy
                .get("x_oss_forbid_overwrite")
                .and_then(|x| x.as_str())
                .unwrap_or("true")
                .to_string(),
        )
        .text("key", key.to_string())
        .text("success_action_status", "200")
        .part(
            "file",
            reqwest::multipart::Part::bytes(bytes).file_name(file_name.to_string()),
        )
}

pub async fn upload_dashscope_temp_oss_url(
    _client: &reqwest::Client,
    api_key: &str,
    model_name: &str,
    audio_path: &Path,
    log: &impl Fn(&str),
) -> Result<String, String> {
    log(&format!("INFO dashscope upload_policy model={model_name}"));
    let policy_resp = send_stt_cloud_get(|http| {
        http.get(DASHSCOPE_UPLOADS_URL)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .query(&[("action", "getPolicy"), ("model", model_name)])
    })
    .await
    .map_err(|e| format!("百炼上传凭证请求失败: {e}"))?;
    if !policy_resp.status().is_success() {
        let status = policy_resp.status();
        let body = policy_resp.text().await.unwrap_or_default();
        return Err(format!(
            "百炼上传凭证 HTTP {}: {}",
            status,
            body.chars().take(400).collect::<String>()
        ));
    }
    let policy_json: Value = policy_resp.json().await.map_err(|e| e.to_string())?;
    let policy = policy_json
        .get("data")
        .ok_or_else(|| "百炼上传凭证缺少 data".to_string())?;

    let upload_host = policy
        .get("upload_host")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "百炼上传凭证缺少 upload_host".to_string())?;
    let upload_dir = policy
        .get("upload_dir")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "百炼上传凭证缺少 upload_dir".to_string())?;
    let file_name = audio_path
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("audio.wav");
    let key = format!("{upload_dir}/{file_name}");
    let oss_url = format!("oss://{key}");

    let bytes = read_audio_bytes_limited(audio_path)?;
    log(&format!(
        "INFO dashscope upload_oss bytes={} key={}",
        bytes.len(),
        key
    ));

    let upload_resp = send_stt_cloud_post(|http| {
        http.post(upload_host).multipart(build_oss_upload_form(
            policy,
            &key,
            file_name,
            bytes.clone(),
        ))
    })
    .await
    .map_err(|e| format!("百炼 OSS 上传失败: {e}"))?;
    if !upload_resp.status().is_success() {
        let status = upload_resp.status();
        let body = upload_resp.text().await.unwrap_or_default();
        return Err(format!(
            "百炼 OSS 上传 HTTP {}: {}",
            status,
            body.chars().take(400).collect::<String>()
        ));
    }

    Ok(oss_url)
}
