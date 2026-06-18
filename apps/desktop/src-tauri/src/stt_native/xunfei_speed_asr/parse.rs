//! 解析讯飞 lattice → Rushi segments。

use serde_json::{json, Value};

use crate::project::online_segment_normalize::{
    refine_long_speech_segments, OnlineSegmentNormalizeOptions,
};

pub type LatticeParseResult = (Vec<Value>, String, Option<f64>);

fn ms_str_to_sec(raw: &Value) -> Option<f64> {
    raw.as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| raw.as_f64())
        .map(|ms| ms / 1000.0)
}

fn lattice_item_text(item: &Value) -> String {
    let mut out = String::new();
    let Some(st) = item.pointer("/json_1best/st") else {
        return out;
    };
    let rt = st.get("rt").and_then(|r| r.as_array());
    let Some(rt) = rt else {
        return out;
    };
    for rt_item in rt {
        let Some(ws_arr) = rt_item.get("ws").and_then(|w| w.as_array()) else {
            continue;
        };
        for ws in ws_arr {
            let Some(cw_arr) = ws.get("cw").and_then(|c| c.as_array()) else {
                continue;
            };
            for cw in cw_arr {
                if let Some(w) = cw.get("w").and_then(|x| x.as_str()) {
                    out.push_str(w);
                }
            }
        }
    }
    out
}

pub fn parse_lattice_result(query_json: &Value) -> Result<LatticeParseResult, String> {
    let lattice = query_json
        .pointer("/data/result/lattice")
        .or_else(|| query_json.pointer("/data/lattice"))
        .and_then(|l| l.as_array())
        .ok_or_else(|| "讯飞结果缺少 lattice".to_string())?;

    let mut segments: Vec<Value> = Vec::new();
    let mut full_parts: Vec<String> = Vec::new();

    for item in lattice {
        let text = lattice_item_text(item).trim().to_string();
        if text.is_empty() {
            continue;
        }
        let start = item
            .get("bg")
            .and_then(ms_str_to_sec)
            .or_else(|| item.pointer("/json_1best/st/bg").and_then(ms_str_to_sec))
            .unwrap_or(0.0);
        let end = item
            .get("ed")
            .and_then(ms_str_to_sec)
            .or_else(|| item.pointer("/json_1best/st/ed").and_then(ms_str_to_sec))
            .unwrap_or(start);
        segments.push(json!({
            "start_sec": start,
            "end_sec": end.max(start),
            "text": text,
            "confidence": Value::Null,
            "low_confidence": false,
            "kind": "speech",
        }));
        full_parts.push(text);
    }

    if segments.is_empty() {
        return Err("讯飞 lattice 未解析出语段".to_string());
    }

    let refine_opts = OnlineSegmentNormalizeOptions::cjk_oral();
    segments = refine_long_speech_segments(segments, &[], &refine_opts);

    let full_text = full_parts.join("");
    let duration_sec = segments
        .last()
        .and_then(|s| s.get("end_sec").and_then(|e| e.as_f64()));
    Ok((segments, full_text, duration_sec))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sample_lattice_to_segments() {
        let sample = json!({
            "data": {
                "result": {
                    "lattice": [{
                        "bg": "0",
                        "ed": "4950",
                        "json_1best": {
                            "st": {
                                "bg": "0",
                                "ed": "4950",
                                "rt": [{
                                    "ws": [{
                                        "cw": [{ "w": "你好", "wc": "1.0" }]
                                    }]
                                }]
                            }
                        }
                    }, {
                        "bg": "4950",
                        "ed": "9000",
                        "json_1best": {
                            "st": {
                                "rt": [{
                                    "ws": [{
                                        "cw": [{ "w": "世界" }]
                                    }]
                                }]
                            }
                        }
                    }]
                }
            }
        });
        let (segments, full_text, _) = parse_lattice_result(&sample).expect("parse");
        assert!(segments.len() >= 2);
        assert!(full_text.contains("你好"));
        assert!(full_text.contains("世界"));
    }
}
