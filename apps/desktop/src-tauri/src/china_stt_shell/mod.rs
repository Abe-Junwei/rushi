//! 国内厂商壳直连：讯飞 WS v2、华为 SIS 一句话、思必驰 LASR v2、火山豆包 v3 nostream（二进制帧）。

pub mod aispeech;
pub mod huawei;
pub mod iflytek;
pub mod volcengine;

use serde_json::json;

pub fn rushi_value(
    segments: Vec<serde_json::Value>,
    full_text: String,
    engine: &str,
    duration_sec: Option<f64>,
    mut warnings: Vec<String>,
) -> serde_json::Value {
    if segments.is_empty() && !full_text.trim().is_empty() {
        warnings.push("厂商未返回分句时间戳，已退化为单条语段。".to_string());
    }
    let segs = if segments.is_empty() && !full_text.trim().is_empty() {
        vec![json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
        })]
    } else {
        segments
    };
    json!({
        "schema_version": "1",
        "segments": segs,
        "full_text": full_text,
        "engine": engine,
        "duration_sec": duration_sec,
        "warnings": warnings,
    })
}

pub fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(data);
    hex::encode(h.finalize())
}

pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

pub fn split_pipe2<'a>(raw: &'a str, label: &str) -> Result<(&'a str, &'a str), String> {
    let t = raw.trim().strip_prefix("Bearer ").unwrap_or(raw).trim();
    let (a, b) = t.split_once('|').ok_or_else(|| {
        format!("{label}：请在内存凭证中使用 `公开值|密钥` 两段，以英文竖线 `|` 分隔（无空格）。")
    })?;
    let a = a.trim();
    let b = b.trim();
    if a.is_empty() || b.is_empty() {
        return Err(format!("{label}：`|` 两侧不能为空。"));
    }
    Ok((a, b))
}

pub fn wav_strip_to_pcm(bytes: &[u8]) -> &[u8] {
    if bytes.len() > 44 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WAVE" {
        if let Some(pos) = find_wav_data_chunk(bytes) {
            return &bytes[pos..];
        }
        return &bytes[44..];
    }
    bytes
}

pub fn find_wav_data_chunk(bytes: &[u8]) -> Option<usize> {
    let mut i = 12usize;
    while i + 8 <= bytes.len() {
        let sz = u32::from_le_bytes(bytes[i + 4..i + 8].try_into().ok()?) as usize;
        if &bytes[i..i + 4] == b"data" {
            return Some(i + 8);
        }
        i = i.checked_add(8)?.checked_add(sz)?;
    }
    None
}
