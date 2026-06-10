//! DashScope speech-biasing vocabulary sync (ACC-STT-ALI).

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

use serde_json::{json, Value};

use crate::project::stt_vocabulary::SttVocabularyPlan;

pub const DASHSCOPE_FUNASR_FILE_MODEL: &str = "fun-asr";
pub const DASHSCOPE_VOCABULARY_TARGET_MODEL: &str = "fun-asr";
pub const DASHSCOPE_CUSTOMIZATION_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/customization";
pub const DASHSCOPE_VOCABULARY_PREFIX: &str = "rushi";
pub const DASHSCOPE_HOTWORD_WEIGHT: i64 = 4;

const DASHSCOPE_TERM_MAX_CHARS: usize = 15;
const DASHSCOPE_ASCII_MAX_SEGMENTS: usize = 7;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DashscopeVocabularyBuild {
    pub items: Vec<Value>,
    pub included_term_count: usize,
    pub dropped_term_count: usize,
}

static VOCAB_CACHE: Mutex<Option<(String, u64)>> = Mutex::new(None);

pub fn dashscope_term_valid(term: &str) -> bool {
    let t = term.trim();
    if t.is_empty() {
        return false;
    }
    let has_non_ascii = t.chars().any(|c| !c.is_ascii());
    if has_non_ascii {
        return t.chars().count() <= DASHSCOPE_TERM_MAX_CHARS;
    }
    t.split_whitespace().count() <= DASHSCOPE_ASCII_MAX_SEGMENTS
}

pub fn build_dashscope_vocabulary_items(plan: &SttVocabularyPlan) -> DashscopeVocabularyBuild {
    let mut items = Vec::new();
    let mut included = 0usize;
    let mut dropped = 0usize;
    for term in &plan.terms {
        let t = term.trim();
        if t.is_empty() {
            continue;
        }
        if !dashscope_term_valid(t) {
            dropped += 1;
            continue;
        }
        items.push(json!({
            "text": t,
            "weight": DASHSCOPE_HOTWORD_WEIGHT,
            "lang": "zh"
        }));
        included += 1;
    }
    DashscopeVocabularyBuild {
        items,
        included_term_count: included,
        dropped_term_count: dropped,
    }
}

fn vocabulary_items_hash(items: &[Value]) -> u64 {
    let mut hasher = DefaultHasher::new();
    for item in items {
        item.to_string().hash(&mut hasher);
    }
    hasher.finish()
}

fn strip_bearer(raw: &str) -> &str {
    raw.trim().strip_prefix("Bearer ").unwrap_or(raw.trim()).trim()
}

async fn post_customization(
    client: &reqwest::Client,
    api_key: &str,
    body: Value,
) -> Result<Value, String> {
    let _ = client;
    let resp = super::send_stt_cloud_post(|http| {
        http.post(DASHSCOPE_CUSTOMIZATION_URL)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await
    .map_err(|e| format!("百炼热词 API 请求失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "百炼热词 HTTP {}: {}",
            status,
            text.chars().take(400).collect::<String>()
        ));
    }
    serde_json::from_str(&text).map_err(|e| format!("百炼热词 JSON: {e}"))
}

async fn find_existing_vocabulary_id(
    client: &reqwest::Client,
    api_key: &str,
) -> Result<Option<String>, String> {
    let j = post_customization(
        client,
        api_key,
        json!({
            "model": "speech-biasing",
            "input": {
                "action": "list_vocabulary",
                "prefix": DASHSCOPE_VOCABULARY_PREFIX,
                "page_index": 0,
                "page_size": 10
            }
        }),
    )
    .await?;
    let list = j
        .pointer("/output/vocabulary_list")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    for entry in list {
        let status = entry.get("status").and_then(|x| x.as_str()).unwrap_or("");
        if status != "OK" {
            continue;
        }
        if let Some(id) = entry.get("vocabulary_id").and_then(|x| x.as_str()) {
            if !id.is_empty() {
                return Ok(Some(id.to_string()));
            }
        }
    }
    Ok(None)
}

/// Sync glossary terms to DashScope; returns `vocabulary_id` when non-empty.
pub async fn sync_dashscope_vocabulary(
    client: &reqwest::Client,
    authorization: &str,
    plan: &SttVocabularyPlan,
    log: &impl Fn(&str),
) -> Result<Option<String>, String> {
    let api_key = strip_bearer(authorization);
    if api_key.is_empty() {
        return Err("百炼 ASR：请在内存凭证中填写百炼 API Key（sk-…）".to_string());
    }
    let build = build_dashscope_vocabulary_items(plan);
    if build.items.is_empty() {
        return Ok(None);
    }
    let hash = vocabulary_items_hash(&build.items);
    if let Some((cached_id, cached_hash)) = VOCAB_CACHE.lock().expect("vocab cache lock").clone() {
        if cached_hash == hash {
            return Ok(Some(cached_id));
        }
    }

    if let Some(existing) = find_existing_vocabulary_id(client, api_key).await? {
        log("INFO dashscope vocabulary update");
        post_customization(
            client,
            api_key,
            json!({
                "model": "speech-biasing",
                "input": {
                    "action": "update_vocabulary",
                    "vocabulary_id": existing,
                    "vocabulary": build.items
                }
            }),
        )
        .await?;
        *VOCAB_CACHE.lock().expect("vocab cache lock") = Some((existing.clone(), hash));
        return Ok(Some(existing));
    }

    log("INFO dashscope vocabulary create");
    let j = post_customization(
        client,
        api_key,
        json!({
            "model": "speech-biasing",
            "input": {
                "action": "create_vocabulary",
                "target_model": DASHSCOPE_VOCABULARY_TARGET_MODEL,
                "prefix": DASHSCOPE_VOCABULARY_PREFIX,
                "vocabulary": build.items
            }
        }),
    )
    .await?;
    let id = j
        .pointer("/output/vocabulary_id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "百炼热词创建未返回 vocabulary_id".to_string())?
        .to_string();
    *VOCAB_CACHE.lock().expect("vocab cache lock") = Some((id.clone(), hash));
    Ok(Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_dashscope_term_limits() {
        assert!(dashscope_term_valid("赛德克巴莱"));
        assert!(dashscope_term_valid("EGFR抑制剂"));
        assert!(!dashscope_term_valid("Клофелин Белмедпрепараты"));
        assert!(dashscope_term_valid("Human immunodeficiency virus type 1"));
        assert!(!dashscope_term_valid(
            "The effect of temperature variations on enzyme activity in biochemical reactions"
        ));
    }

    #[test]
    fn build_drops_invalid_terms() {
        let long_ascii = "one two three four five six seven eight";
        let plan = SttVocabularyPlan {
            hotwords: format!("有效词 {long_ascii}"),
            terms: vec!["有效词".to_string(), long_ascii.to_string()],
        };
        let build = build_dashscope_vocabulary_items(&plan);
        assert_eq!(build.included_term_count, 1);
        assert_eq!(build.dropped_term_count, 1);
    }
}
