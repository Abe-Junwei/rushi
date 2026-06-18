//! 讯飞 OST 文件上传（直传 + 分块）。

use std::path::Path;

use reqwest::Client;
use serde_json::Value;
use uuid::Uuid;

use super::auth::{signed_json_headers, signed_multipart_headers};
use super::super::send_stt_cloud_post;

pub const XUNFEI_UPLOAD_HOST: &str = "upload-ost-api.xfyun.cn";

const CHUNK_THRESHOLD: u64 = 30 * 1024 * 1024;
const SLICE_SIZE: usize = 10 * 1024 * 1024;

fn api_code_ok(j: &Value) -> bool {
    j.get("code")
        .and_then(|c| c.as_i64().or_else(|| c.as_str().and_then(|s| s.parse().ok())))
        == Some(0)
        || j.get("ok").and_then(|x| x.as_i64()) == Some(1)
}

fn api_error_message(j: &Value) -> String {
    j.get("message")
        .or_else(|| j.get("desc"))
        .and_then(|m| m.as_str())
        .unwrap_or("讯飞上传失败")
        .to_string()
}

fn extract_audio_url(j: &Value) -> Result<String, String> {
    if !api_code_ok(j) {
        return Err(api_error_message(j));
    }
    j.pointer("/data/url")
        .or_else(|| j.pointer("/data/audio_url"))
        .and_then(|u| u.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "讯飞上传响应缺少 data.url".to_string())
}

fn json_wrap_raw(text: &str) -> Value {
    serde_json::json!({ "code": -1, "message": text })
}

fn append_multipart_text_field(body: &mut Vec<u8>, boundary: &str, name: &str, value: &str) {
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{name}\"\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(value.as_bytes());
    body.extend_from_slice(b"\r\n");
}

fn append_multipart_file_field(
    body: &mut Vec<u8>,
    boundary: &str,
    file_bytes: &[u8],
    filename: &str,
) {
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"data\"; filename=\"{filename}\"\r\n").as_bytes(),
    );
    body.extend_from_slice(b"Content-Type: application/octet-stream\r\n\r\n");
    body.extend_from_slice(file_bytes);
    body.extend_from_slice(b"\r\n");
}

fn build_multipart_upload(
    app_id: &str,
    request_id: &str,
    file_bytes: &[u8],
    filename: &str,
) -> (Vec<u8>, String) {
    let boundary = format!("----RushiBoundary{}", Uuid::new_v4().simple());
    let mut body = Vec::new();
    // 讯飞官方示例：data 段必须在前，否则服务端可能读不到后续 slice_id 等字段。
    append_multipart_file_field(&mut body, &boundary, file_bytes, filename);
    append_multipart_text_field(&mut body, &boundary, "app_id", app_id);
    append_multipart_text_field(&mut body, &boundary, "request_id", request_id);
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    let content_type = format!("multipart/form-data; boundary={boundary}");
    (body, content_type)
}

fn build_multipart_slice_upload(
    app_id: &str,
    request_id: &str,
    upload_id: &str,
    slice_id: usize,
    file_bytes: &[u8],
    filename: &str,
) -> (Vec<u8>, String) {
    let boundary = format!("----RushiBoundary{}", Uuid::new_v4().simple());
    let slice_id_str = slice_id.to_string();
    let mut body = Vec::new();
    append_multipart_file_field(&mut body, &boundary, file_bytes, filename);
    append_multipart_text_field(&mut body, &boundary, "app_id", app_id);
    append_multipart_text_field(&mut body, &boundary, "request_id", request_id);
    append_multipart_text_field(&mut body, &boundary, "upload_id", upload_id);
    append_multipart_text_field(&mut body, &boundary, "slice_id", &slice_id_str);
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    let content_type = format!("multipart/form-data; boundary={boundary}");
    (body, content_type)
}

async fn post_signed_multipart(
    _client: &Client,
    host: &str,
    path: &str,
    body: Vec<u8>,
    content_type: &str,
    api_key: &str,
    api_secret: &str,
) -> Result<Value, String> {
    let url = format!("https://{host}{path}");
    let resp = send_stt_cloud_post(|c| {
        let headers = signed_multipart_headers(host, path, &body, content_type, api_key, api_secret);
        let mut req = c.post(&url).body(body.clone());
        for (k, v) in headers {
            req = req.header(k, v);
        }
        req
    })
    .await
    .map_err(|e| format!("讯飞上传 HTTP 失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取上传响应: {e}"))?;
    let j: Value = serde_json::from_str(&text).unwrap_or_else(|_| json_wrap_raw(&text));
    if !status.is_success() && !api_code_ok(&j) {
        return Err(format!("讯飞上传 HTTP {status}: {text}"));
    }
    Ok(j)
}

async fn post_signed_json(
    _client: &Client,
    host: &str,
    path: &str,
    payload: Value,
    api_key: &str,
    api_secret: &str,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&payload).map_err(|e| format!("序列化 JSON: {e}"))?;
    let url = format!("https://{host}{path}");
    let resp = send_stt_cloud_post(|c| {
        let headers = signed_json_headers(host, path, &body, api_key, api_secret);
        let mut req = c.post(&url).body(body.clone());
        for (k, v) in headers {
            req = req.header(k, v);
        }
        req
    })
    .await
    .map_err(|e| format!("讯飞 HTTP 失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应: {e}"))?;
    let j: Value = serde_json::from_str(&text).unwrap_or_else(|_| json_wrap_raw(&text));
    if !status.is_success() && !api_code_ok(&j) {
        return Err(format!("讯飞 HTTP {status}: {text}"));
    }
    Ok(j)
}

async fn upload_small_file(
    client: &Client,
    app_id: &str,
    file_bytes: &[u8],
    filename: &str,
    api_key: &str,
    api_secret: &str,
) -> Result<String, String> {
    let request_id = Uuid::new_v4().to_string();
    let (body, content_type) = build_multipart_upload(app_id, &request_id, file_bytes, filename);
    let j = post_signed_multipart(
        client,
        XUNFEI_UPLOAD_HOST,
        "/file/upload",
        body,
        &content_type,
        api_key,
        api_secret,
    )
    .await?;
    extract_audio_url(&j)
}

async fn upload_multipart_file(
    client: &Client,
    app_id: &str,
    file_bytes: &[u8],
    _filename: &str,
    api_key: &str,
    api_secret: &str,
) -> Result<String, String> {
    let init_payload = serde_json::json!({
        "app_id": app_id,
        "request_id": Uuid::new_v4().to_string(),
    });
    let init_j = post_signed_json(
        client,
        XUNFEI_UPLOAD_HOST,
        "/file/mpupload/init",
        init_payload,
        api_key,
        api_secret,
    )
    .await?;
    let upload_id = init_j
        .pointer("/data/upload_id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "分块 init 缺少 upload_id".to_string())?;

    let total_slices = file_bytes.len().div_ceil(SLICE_SIZE);
    for slice_id in 0..total_slices {
        let start = slice_id * SLICE_SIZE;
        let end = ((slice_id + 1) * SLICE_SIZE).min(file_bytes.len());
        let slice = &file_bytes[start..end];
        let request_id = Uuid::new_v4().to_string();
        let (slice_body, slice_ct) = build_multipart_slice_upload(
            app_id,
            &request_id,
            upload_id,
            slice_id,
            slice,
            &format!("slice_{slice_id}.bin"),
        );
        let slice_j = post_signed_multipart(
            client,
            XUNFEI_UPLOAD_HOST,
            "/file/mpupload/upload",
            slice_body,
            &slice_ct,
            api_key,
            api_secret,
        )
        .await?;
        if !api_code_ok(&slice_j) {
            return Err(api_error_message(&slice_j));
        }
    }

    let complete_j = post_signed_json(
        client,
        XUNFEI_UPLOAD_HOST,
        "/file/mpupload/complete",
        serde_json::json!({
            "app_id": app_id,
            "request_id": Uuid::new_v4().to_string(),
            "upload_id": upload_id,
        }),
        api_key,
        api_secret,
    )
    .await?;
    extract_audio_url(&complete_j)
}

pub async fn upload_audio_file(
    client: &Client,
    app_id: &str,
    wav_path: &Path,
    api_key: &str,
    api_secret: &str,
    log: &impl Fn(&str),
) -> Result<String, String> {
    let file_bytes = super::super::read_audio_bytes_limited(wav_path)?;
    let filename = wav_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.wav");
    log(&format!(
        "INFO xunfei upload bytes={} multipart={}",
        file_bytes.len(),
        file_bytes.len() as u64 >= CHUNK_THRESHOLD
    ));
    if file_bytes.len() as u64 >= CHUNK_THRESHOLD {
        upload_multipart_file(client, app_id, &file_bytes, filename, api_key, api_secret).await
    } else {
        upload_small_file(client, app_id, &file_bytes, filename, api_key, api_secret).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slice_multipart_puts_data_before_metadata_fields() {
        let (body, _) = build_multipart_slice_upload(
            "app123",
            "req-1",
            "upload-abc",
            2,
            b"slice-bytes",
            "slice_2.bin",
        );
        let text = String::from_utf8_lossy(&body);
        let data_pos = text.find("name=\"data\"").expect("data part");
        let slice_pos = text.find("name=\"slice_id\"").expect("slice_id part");
        assert!(data_pos < slice_pos, "data must precede slice_id per Xunfei API");
        assert!(text.contains("upload-abc"));
        assert!(text.contains("slice_id\"\r\n\r\n2\r\n") || text.contains("slice_id\"\r\n\r\n2\n"));
    }

    #[test]
    fn small_multipart_puts_data_before_app_id() {
        let (body, _) = build_multipart_upload("app123", "req-1", b"bytes", "audio.wav");
        let text = String::from_utf8_lossy(&body);
        let data_pos = text.find("name=\"data\"").expect("data part");
        let app_pos = text.find("name=\"app_id\"").expect("app_id part");
        assert!(data_pos < app_pos);
    }
}
