//! Glossary → per–online-STT vocabulary mapping (ACC-STT-UNIFY U1/U2).

use super::glossary_hotwords::GlossaryHotwordsBuild;

const OPENAI_PROMPT_MAX_CHARS: usize = 224;
const ASSEMBLYAI_KEYTERMS_MAX: usize = 100;
const DEEPGRAM_KEYWORDS_MAX: usize = 50;

/// Shared plan from ``build_glossary_hotwords`` (single term真源).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SttVocabularyPlan {
    pub hotwords: String,
    pub terms: Vec<String>,
}

impl SttVocabularyPlan {
    pub fn from_build(build: &GlossaryHotwordsBuild) -> Self {
        let terms: Vec<String> = build
            .hotwords
            .split_whitespace()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
        Self {
            hotwords: build.hotwords.clone(),
            terms,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.hotwords.trim().is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SttVocabularyChannel {
    LocalFunasrMultipart,
    OpenAiPrompt,
    AssemblyAiKeyterms,
    DeepgramKeywords,
    GenericMultipartHotwords,
    Unsupported,
}

pub fn channel_for_online(native_adapter: Option<&str>, multipart_fallback: bool) -> SttVocabularyChannel {
    match native_adapter {
        Some("openaiAudio") => SttVocabularyChannel::OpenAiPrompt,
        Some("assemblyai") => SttVocabularyChannel::AssemblyAiKeyterms,
        Some("deepgramListen") => SttVocabularyChannel::DeepgramKeywords,
        _ if multipart_fallback => SttVocabularyChannel::GenericMultipartHotwords,
        _ => SttVocabularyChannel::Unsupported,
    }
}

pub fn openai_prompt(plan: &SttVocabularyPlan) -> Option<String> {
    let trimmed = plan.hotwords.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.chars().take(OPENAI_PROMPT_MAX_CHARS).collect())
}

pub fn assemblyai_keyterms(plan: &SttVocabularyPlan) -> Vec<String> {
    plan.terms
        .iter()
        .take(ASSEMBLYAI_KEYTERMS_MAX)
        .cloned()
        .collect()
}

pub fn append_deepgram_keywords(base_url: &str, plan: &SttVocabularyPlan) -> String {
    let mut url = base_url.trim().to_string();
    if plan.terms.is_empty() {
        return url;
    }
    let sep = if url.contains('?') { '&' } else { '?' };
    let mut first = true;
    for term in plan.terms.iter().take(DEEPGRAM_KEYWORDS_MAX) {
        if term.is_empty() {
            continue;
        }
        url.push(if first { sep } else { '&' });
        first = false;
        url.push_str("keywords=");
        url.push_str(&urlencoding::encode(term));
    }
    url
}

/// Pre-flight hints when vocabulary cannot be applied or was truncated.
pub fn vocabulary_support_warnings(
    channel: SttVocabularyChannel,
    plan: &SttVocabularyPlan,
    hotwords_truncated: bool,
) -> Vec<String> {
    let mut out = Vec::new();
    if hotwords_truncated {
        out.push("hotwords_truncated_12k".to_string());
    }
    if plan.is_empty() {
        return out;
    }
    match channel {
        SttVocabularyChannel::Unsupported => {
            out.push("online_vocabulary_unsupported".to_string());
        }
        SttVocabularyChannel::OpenAiPrompt => {
            if plan.hotwords.chars().count() > OPENAI_PROMPT_MAX_CHARS {
                out.push("online_vocabulary_truncated_openai_prompt".to_string());
            }
        }
        SttVocabularyChannel::AssemblyAiKeyterms => {
            if plan.terms.len() > ASSEMBLYAI_KEYTERMS_MAX {
                out.push("online_vocabulary_truncated_assemblyai_keyterms".to_string());
            }
        }
        SttVocabularyChannel::DeepgramKeywords => {
            if plan.terms.len() > DEEPGRAM_KEYWORDS_MAX {
                out.push("online_vocabulary_truncated_deepgram_keywords".to_string());
            }
        }
        SttVocabularyChannel::LocalFunasrMultipart
        | SttVocabularyChannel::GenericMultipartHotwords => {}
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openai_prompt_truncates_to_224_chars() {
        let long = "词".repeat(300);
        let plan = SttVocabularyPlan {
            hotwords: long.clone(),
            terms: vec!["词".to_string()],
        };
        let p = openai_prompt(&plan).expect("prompt");
        assert_eq!(p.chars().count(), OPENAI_PROMPT_MAX_CHARS);
    }

    #[test]
    fn assemblyai_keyterms_splits_whitespace() {
        let plan = SttVocabularyPlan {
            hotwords: "制控 主任".into(),
            terms: vec!["制控".into(), "主任".into()],
        };
        assert_eq!(assemblyai_keyterms(&plan), vec!["制控", "主任"]);
    }

    #[test]
    fn deepgram_keywords_query_appends() {
        let plan = SttVocabularyPlan {
            hotwords: "制控".into(),
            terms: vec!["制控".into()],
        };
        let url = append_deepgram_keywords(
            "https://api.deepgram.com/v1/listen?model=nova-2",
            &plan,
        );
        assert!(url.contains("keywords="));
        assert!(url.contains("%E5%88%B6%E6%8E%A7") || url.contains("制控"));
    }

    #[test]
    fn unsupported_channel_warns_when_plan_nonempty() {
        let plan = SttVocabularyPlan {
            hotwords: "制控".into(),
            terms: vec!["制控".into()],
        };
        let w = vocabulary_support_warnings(SttVocabularyChannel::Unsupported, &plan, false);
        assert!(w.iter().any(|x| x == "online_vocabulary_unsupported"));
    }
}
