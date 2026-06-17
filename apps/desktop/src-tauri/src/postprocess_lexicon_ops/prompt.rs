use super::super::postprocess_segment_ops::RefineSegmentItem;
use crate::project::lexicon_pack::LexiconPack;

pub fn default_stage_b_system_prompt() -> &'static str {
    "你是中文转写后处理助手。只输出 JSON 对象，包含 ops 与可选 rationale；每条修改必须带 evidence。"
}

pub fn default_stage_b_instructions() -> String {
    [
        "任务：对下列语段依次（1）补充自然、克制的中文标点；（2）依据词表与纠错规则改正字（专名、术语、同音误写、前后不一致）。",
        "约束：",
        "1. 只输出一个 JSON 对象，不要 markdown 代码块。",
        "2. ops 仅可包含 op=update_text，且 uid 必须来自输入。",
        "3. 每条 op 必须带 evidence：type 为 punctuation | rule | glossary | inconsistent_term | homophone。",
        "4. 仅补标点、未改字时 evidence.type=punctuation，ref=补标点。",
        "5. rule 的 ref 格式为「错→对」：须与 correction_rules 完全一致，或「对」为词表 canonical 之一。",
        "6. glossary 的 ref 为术语表 canonical 全文；同音改正也可用 rule 且「对」为 canonical。",
        "7. inconsistent_term 的 ref 须包含词表 canonical 或「统一为：<词条>」。",
        "8. 同音误写但 Pack 中无对应规则时，用 homophone + ref「错→对」；会作为「同音推测」候选展示，由用户确认。",
        "9. 不要 merge/split 语段；不要润色、扩写或改时间轴。",
        "10. 无把握时返回空 ops。",
        r#"JSON 形状：{"ops":[{"op":"update_text","uid":"...","text":"...","evidence":{"type":"punctuation","ref":"补标点"}}],"rationale":"可选"}"#,
    ]
    .join("\n")
}

fn resolve_stage_b_instructions(instructions_override: Option<&str>) -> String {
    instructions_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_stage_b_instructions)
}

pub fn resolve_stage_b_system_prompt(system_override: Option<&str>) -> String {
    system_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| default_stage_b_system_prompt().to_string())
}

/// F0-v2+：一次 LLM 调用完成标点 + 词表有据改字。
pub fn build_stage_b_merged_proofread_prompt(
    segments: &[RefineSegmentItem],
    pack: &LexiconPack,
    instructions_override: Option<&str>,
) -> String {
    let preamble = resolve_stage_b_instructions(instructions_override);
    let mut lines = vec![preamble, "词表 canonical：".to_string()];
    if pack.glossary_canonical.is_empty() {
        lines.push("（空）".to_string());
    } else {
        for t in &pack.glossary_canonical {
            lines.push(format!("- {t}"));
        }
    }
    lines.push("纠错规则：".to_string());
    if pack.correction_rules.is_empty() {
        lines.push("（空）".to_string());
    } else {
        for r in &pack.correction_rules {
            lines.push(format!("- [{}] {}→{}", r.weight, r.wrong, r.right));
        }
    }
    lines.push("输入语段：".to_string());
    for s in segments {
        lines.push(format!(
            "- uid={} [{:.3},{:.3}] {}",
            s.uid.trim(),
            s.start_sec,
            s.end_sec,
            s.text.trim()
        ));
    }
    lines.join("\n")
}
