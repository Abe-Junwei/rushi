use serde::Serialize;

use super::lines_from_export_polish_body;

const MANDATORY_SYSTEM_CONTRACT: &str = "items 的 id 必须完整、唯一地返回 0 到本批最后一项；text 只允许调整标点和空白，禁止改动、增删任何正文字符。最终只输出含 items 与 break_after_line 的合法 JSON，禁止 lines、paragraphs 字段。";
const LECTURE_OPTIMIZE_SYSTEM_CONTRACT: &str = "客户端原文是唯一真源。只在 edits 中返回确实需要修改的语段；未返回的 uid 表示原文不变。每条 edit 必须使用输入中的稳定 uid 和非空 text，禁止合并、换序、摘要、添加事实、删除整个语段，或把相邻 uid 的原句/改写复制到本 uid。最终只输出含 edits 与 break_after_uid 的合法 JSON。";

#[derive(Serialize)]
struct PromptItem {
    id: usize,
    text: String,
}

pub fn default_export_polish_system_prompt() -> &'static str {
    "你是中文讲稿标点与分段助手。items 的 id 必须完整、唯一地返回 0 到本批最后一项；text 只允许调整标点和空白，禁止改动、增删任何正文字符。最终只输出含 items 与 break_after_line 的合法 JSON，禁止 lines、paragraphs 字段。"
}

pub fn default_export_lecture_optimize_system_prompt() -> &'static str {
    "你是中文讲稿编辑。保留原意、事实、观点和语段顺序，可去除口头赘词与无意义重复、修正明显语病、理顺口语语序并调整标点。只返回确实需要修改的稀疏 edits；未返回的 uid 保持原文。禁止摘要、扩写、合并、换序、删除整个语段，或把相邻 uid 的内容复述到本 uid。最终只输出含 edits 与 break_after_uid 的合法 JSON。"
}

pub fn default_export_polish_instructions_template() -> String {
    r#"你是中文讲稿标点与分段助手。输入为 {line_count} 条已完成正文纠错的语段；不得再修改正文字符。{batch_note}

## 输出 JSON（仅此结构）
{"items":[{"id":0,"text":"第一条"},...,{"id":{line_count_minus_one},"text":"最后一条"}],"break_after_line":[0,3,7]}

## items（必须恰好 {line_count} 项）
- `id` 必须完整返回输入中的 0 到 {line_count_minus_one}，不得缺失、重复、换号或合并。
- `text` 的非标点正文已经过可信纠错规则处理，必须逐字保留；只允许调整标点与空白。
- 无需调整标点的项请原样抄写。

允许处理的错误标点：
   - 句末缺标点则补「。」「？」「！」；陈述/疑问/感叹语气用对应句末标点。
   - 逗号「，」与顿号「、」误用：并列词语用顿号，分句用逗号。
   - 英文标点混入中文句（`,` `.` `?` `!` `:` `;`）改为中文对应标点。
   - 明显错用的引号、括号、冒号（未配对或语气不符）予以改正。
   - 仅改正错误或缺失；不要为「更好读」而大量重排标点。
## break_after_line
语义自然段：在哪些行**之后**另起段落（0 起下标，升序）。按语义合并短句，但**单段建议不超过约 300 字**；过长请在话题/句群边界切开。分段仅影响 Word 版式，**不得**为分段产生修订。不要输出 paragraphs 字段。{rule_hints}

输入 items（JSON 数组）：
{body}"#
        .to_string()
}

pub fn resolve_export_polish_system_prompt(system_override: Option<&str>) -> String {
    match system_override.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => {
            format!("{custom}\n\n【客户端强制契约】{MANDATORY_SYSTEM_CONTRACT}")
        }
        None => default_export_polish_system_prompt().to_string(),
    }
}

pub(crate) fn validate_export_polish_instructions_template(template: &str) -> Result<(), String> {
    let template = template.trim();
    if template.is_empty() {
        return Ok(());
    }
    let missing: Vec<&str> = ["{line_count}", "{batch_note}", "{rule_hints}", "{body}"]
        .into_iter()
        .filter(|placeholder| !template.contains(placeholder))
        .collect();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "导出润色 User 指令缺少占位符：{}。",
            missing.join("、")
        ))
    }
}

fn apply_template(
    template: &str,
    line_count: usize,
    batch_note: &str,
    rule_hints: &str,
    body: &str,
) -> String {
    let line_count_minus_one = line_count.saturating_sub(1).to_string();
    template
        .replace("{line_count}", &line_count.to_string())
        .replace("{line_count_minus_one}", &line_count_minus_one)
        .replace("{batch_note}", batch_note)
        .replace("{rule_hints}", rule_hints)
        .replace("{body}", body)
}

fn mandatory_user_contract(line_count: usize) -> String {
    let last_id = line_count.saturating_sub(1);
    format!(
        "\n\n【客户端强制输出契约】无论上文如何描述，最终必须只输出 JSON：{{\"items\":[{{\"id\":0,\"text\":\"...\"}},...,{{\"id\":{last_id},\"text\":\"...\"}}],\"break_after_line\":[]}}。items 必须恰好 {line_count} 项；id 不得缺失、重复、改号或越界；text 只允许改标点和空白，正文字符必须逐字保留。"
    )
}

fn lecture_optimize_user_contract() -> &'static str {
    "\n\n【客户端强制输出契约】最终必须只输出 JSON：{\"edits\":[{\"uid\":\"输入中的稳定 uid\",\"text\":\"优化文本\"}],\"break_after_uid\":[\"输入中的稳定 uid\"]}。只在确实需要修改时返回 edit；未返回 uid 表示保持原文，不是失败。edits 可为空；uid 不得重复或使用输入外的值；text 必须非空且只能优化对应输入项，不得复制前后 uid 的原句或改写。break_after_uid 可为空，只表示在该 uid 之后另起自然段。"
}

pub fn build_export_lecture_optimize_prompt(
    body: &str,
    line_uids: &[String],
    rule_hints: &str,
    glossary_hints: &str,
    batch: Option<(usize, usize)>,
) -> String {
    let batch_note = batch
        .map(|(i, n)| {
            format!("【分批 {i}/{n}】这是全稿按顺序切分的连续片段；不要在批边界补写上下文。")
        })
        .unwrap_or_default();
    let mut hints = String::new();
    if !glossary_hints.trim().is_empty() {
        hints.push_str(&format!(
            "\n\n项目专名/术语词表（用于避免误改专名，不得据此新增内容）：\n{}",
            glossary_hints.trim()
        ));
    }
    if !rule_hints.trim().is_empty() {
        hints.push_str(&format!(
            "\n\n稳定纠错规则（可用于修正对应错字，所有变化都会进入 Word 修订轨）：\n{}",
            rule_hints.trim()
        ));
    }
    #[derive(Serialize)]
    struct LecturePromptItem<'a> {
        uid: &'a str,
        text: String,
    }
    let input_items: Vec<LecturePromptItem<'_>> = lines_from_export_polish_body(body)
        .into_iter()
        .zip(line_uids.iter())
        .map(|(text, uid)| LecturePromptItem { uid, text })
        .collect();
    let input_json = serde_json::to_string(&input_items).unwrap_or_else(|_| "[]".to_string());
    let prompt = format!(
        r#"你是中文讲稿编辑。{batch_note}

## 编辑范围
- 可去除“嗯、啊、那个、就是说”等无实义口头赘词和结巴式重复。
- 可修正明显语病、错别字和错误标点，并在不改变含义的前提下理顺本语段语序。
- 必须保留原文事实、观点、数字、人名、专名和有效信息；不得摘要、扩写、拔高或改写立场。
- 只为确实需要修改的输入 uid 返回 edit；未返回 uid 表示原文不变。
- 每条 edit 必须独立对应一个输入 uid 和非空 text；不得跨语段合并、拆分、换序或删除整个语段。
- 不得把前后 uid 的原句、近义改写或上下文补写到当前 uid；当前 edit 只能整理当前 text 已有的信息。

## 输出 JSON
只输出 {{"edits":[{{"uid":"输入 uid","text":"优化文本"}}],"break_after_uid":["输入 uid"]}}。
`edits` 与 `break_after_uid` 都可为空。`break_after_uid` 只影响 Word 排版。{hints}

输入 items：
{input_json}"#
    );
    format!("{prompt}{}", lecture_optimize_user_contract())
}

pub fn resolve_export_lecture_optimize_system_prompt() -> String {
    format!(
        "{}\n\n【客户端强制契约】{}",
        default_export_lecture_optimize_system_prompt(),
        LECTURE_OPTIMIZE_SYSTEM_CONTRACT
    )
}

pub fn build_export_polish_prompt(
    body: &str,
    line_count: usize,
    rule_hints: &str,
    glossary_hints: &str,
    batch: Option<(usize, usize)>,
    instructions_override: Option<&str>,
) -> String {
    let batch_note = batch
        .map(|(i, n)| {
            format!(
                "\n\n【分批 {i}/{n}】下列为全稿按顺序切分的连续片段；break_after_line **仅相对本段** 0 起行下标。若非语义自然段结尾，**不要**在本段最后一行后分段。"
            )
        })
        .unwrap_or_default();
    let mut hints = String::new();
    if !glossary_hints.trim().is_empty() {
        hints.push_str(&format!(
            "\n\n项目专名/术语词表（仅用于理解语义和断句；输入正文已定稿，不得据此替换文字）：\n{}",
            glossary_hints.trim()
        ));
    }
    if !rule_hints.trim().is_empty() {
        hints.push_str(&format!(
            "\n\n已应用的稳定纠错规则（仅供理解上下文；不得再次修改正文）：\n{}",
            rule_hints.trim()
        ));
    }
    let template = instructions_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_export_polish_instructions_template);
    let input_items: Vec<PromptItem> = lines_from_export_polish_body(body)
        .into_iter()
        .enumerate()
        .map(|(id, text)| PromptItem { id, text })
        .collect();
    let input_json = serde_json::to_string(&input_items).unwrap_or_else(|_| "[]".to_string());
    let prompt = apply_template(&template, line_count, &batch_note, &hints, &input_json);
    format!("{prompt}{}", mandatory_user_contract(line_count))
}
