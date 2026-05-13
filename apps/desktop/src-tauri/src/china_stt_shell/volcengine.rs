use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::json;
use tungstenite::{client::IntoClientRequest, Message};
use uuid::Uuid;

use http::header::HeaderValue;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::rushi_value;

const VOLC_MSG_FULL_CLIENT: u8 = 0x01;
const VOLC_MSG_AUDIO_ONLY: u8 = 0x02;
const VOLC_MSG_FULL_SERVER: u8 = 0x09;

fn volc_hdr(
    version: u8,
    message_type: u8,
    flags: u8,
    serialization: u8,
    compression: u8,
) -> [u8; 4] {
    [
        version << 4,
        (message_type << 4) | (flags & 0x0f),
        (serialization << 4) | (compression & 0x0f),
        0,
    ]
}

fn volc_pack_binary(mut header: [u8; 4], seq: Option<u32>, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    match seq {
        None => {
            header[0] = (header[0] & 0xf0) | 0x01;
            out.extend_from_slice(&header);
        }
        Some(s) => {
            header[0] = (header[0] & 0xf0) | 0x02;
            out.extend_from_slice(&header);
            out.extend_from_slice(&s.to_be_bytes());
        }
    }
    out.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    out.extend_from_slice(payload);
    out
}

fn volc_gzip_bytes(raw: &[u8]) -> Result<Vec<u8>, String> {
    let mut enc = GzEncoder::new(Vec::new(), Compression::default());
    enc.write_all(raw).map_err(|e| e.to_string())?;
    enc.finish().map_err(|e| e.to_string())
}

fn volc_gunzip(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut dec = GzDecoder::new(data);
    let mut out = Vec::new();
    dec.read_to_end(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

/// 返回 (JSON, 是否为最后一包 full server response)
fn volc_parse_server_binary(bin: &[u8]) -> Result<Option<(serde_json::Value, bool)>, String> {
    if bin.len() < 8 {
        return Ok(None);
    }
    let header_size = (bin[0] & 0x0f) as usize * 4;
    if bin.len() < header_size + 4 {
        return Ok(None);
    }
    let msg_type = (bin[1] >> 4) & 0x0f;
    let flags = bin[1] & 0x0f;
    let compression = bin[2] & 0x0f;
    let mut off = header_size;
    let payload_len = u32::from_be_bytes(bin[off..off + 4].try_into().unwrap()) as usize;
    off += 4;
    if bin.len() < off + payload_len {
        return Ok(None);
    }
    let payload = &bin[off..off + payload_len];
    if msg_type != VOLC_MSG_FULL_SERVER {
        return Ok(None);
    }
    let json_bytes = if compression == 1 {
        volc_gunzip(payload)?
    } else {
        payload.to_vec()
    };
    let j: serde_json::Value =
        serde_json::from_slice(&json_bytes).map_err(|e| format!("火山响应 JSON: {e}"))?;
    let is_final = flags & 0x03 == 0x03;
    Ok(Some((j, is_final)))
}

pub fn transcribe_volcengine_bigmodel_nostream_ws(
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let app_key = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "火山引擎：请在「应用标识」中填写 X-Api-App-Key（AppId）".to_string())?;
    let access_key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "火山引擎：请在内存凭证中填写 X-Api-Access-Key（控制台 Access Token）".to_string()
        })?;

    let res_id_raw = bridge.transcribe_url.trim();
    let is_http_url = url::Url::parse(res_id_raw)
        .map(|u| matches!(u.scheme(), "http" | "https"))
        .unwrap_or(false);
    let resource_id = if res_id_raw.is_empty() || is_http_url {
        "volc.bigasr.sauc.duration"
    } else {
        res_id_raw
    };

    let wss = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
    let mut req = wss
        .into_client_request()
        .map_err(|e| format!("火山 WS 请求: {e}"))?;
    {
        let h = req.headers_mut();
        h.insert(
            "X-Api-App-Key",
            HeaderValue::from_str(app_key).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Access-Key",
            HeaderValue::from_str(access_key).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Resource-Id",
            HeaderValue::from_str(resource_id).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Connect-Id",
            HeaderValue::from_str(&Uuid::new_v4().to_string()).map_err(|e| e.to_string())?,
        );
    }

    log("INFO volcengine bigmodel_nostream ws");
    let (mut ws, _resp) = tungstenite::connect(req).map_err(|e| format!("火山 WebSocket: {e}"))?;

    let (bytes, ext) = crate::stt_native::audio_bytes_and_format(audio_path)?;
    let format = match ext {
        "mp3" => "mp3",
        "wav" => "wav",
        "ogg" => "ogg",
        _ => "wav",
    };
    let full_req = json!({
        "user": { "uid": "rushi-desktop" },
        "audio": {
            "format": format,
            "rate": 16000,
            "bits": 16,
            "channel": 1,
            "language": "zh-CN",
        },
        "request": {
            "model_name": "bigmodel",
            "enable_itn": true,
            "enable_punc": true,
            "show_utterances": true,
        }
    });
    let gz = volc_gzip_bytes(full_req.to_string().as_bytes())?;
    let h1 = volc_hdr(1, VOLC_MSG_FULL_CLIENT, 0, 1, 1);
    let frame1 = volc_pack_binary(h1, None, &gz);
    ws.send(Message::Binary(frame1))
        .map_err(|e| format!("火山发送 full client: {e}"))?;

    const CHUNK: usize = 6400;
    let mut seq: u32 = 1;
    let mut off = 0usize;
    while off < bytes.len() {
        let end = (off + CHUNK).min(bytes.len());
        let chunk = &bytes[off..end];
        off = end;
        let is_last = off >= bytes.len();
        let gz_a = volc_gzip_bytes(chunk)?;
        let flags = if is_last { 0b0010u8 } else { 0b0000u8 };
        let h2 = volc_hdr(1, VOLC_MSG_AUDIO_ONLY, flags, 0, 1);
        let frame = volc_pack_binary(h2, Some(seq), &gz_a);
        seq = seq.wrapping_add(1);
        ws.send(Message::Binary(frame))
            .map_err(|e| format!("火山发送音频: {e}"))?;
    }

    let deadline = std::time::Instant::now() + timeout;
    let mut last_text = String::new();
    let mut segments: Vec<serde_json::Value> = Vec::new();
    let mut finished = false;
    while !finished {
        if std::time::Instant::now() > deadline {
            return Err("火山识别超时".to_string());
        }
        let m = ws.read().map_err(|e| format!("火山读取: {e}"))?;
        match m {
            Message::Binary(bin) => {
                if let Some((j, is_final)) = volc_parse_server_binary(&bin)? {
                    if let Some(t) = j.pointer("/result/text").and_then(|x| x.as_str()) {
                        last_text = t.to_string();
                    }
                    if let Some(utt) = j.pointer("/result/utterances").and_then(|x| x.as_array()) {
                        segments.clear();
                        for u in utt {
                            let text = u.get("text").and_then(|x| x.as_str()).unwrap_or("").trim();
                            if text.is_empty() {
                                continue;
                            }
                            let start_ms = u
                                .get("start_time")
                                .and_then(|x| x.as_f64())
                                .or_else(|| {
                                    u.get("start_time")
                                        .and_then(|x| x.as_i64().map(|n| n as f64))
                                })
                                .unwrap_or(0.0);
                            let end_ms = u
                                .get("end_time")
                                .and_then(|x| x.as_f64())
                                .or_else(|| {
                                    u.get("end_time").and_then(|x| x.as_i64().map(|n| n as f64))
                                })
                                .unwrap_or(start_ms);
                            segments.push(json!({
                                "start_sec": start_ms / 1000.0,
                                "end_sec": end_ms / 1000.0,
                                "text": text,
                                "confidence": serde_json::Value::Null,
                                "low_confidence": false,
                            }));
                        }
                    }
                    if is_final {
                        finished = true;
                    }
                }
            }
            Message::Close(_) => {
                finished = true;
            }
            _ => {}
        }
    }
    let _ = ws.close(None);
    let warnings = Vec::new();
    Ok(rushi_value(
        segments,
        last_text.trim().to_string(),
        "volcengine:bigmodel_nostream:v3",
        None,
        warnings,
    ))
}
