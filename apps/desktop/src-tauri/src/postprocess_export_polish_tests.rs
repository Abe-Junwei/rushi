use super::*;

#[test]
fn parse_break_and_items() {
    let raw =
        r#"{"items":[{"id":0,"text":"你好"},{"id":1,"text":"世界。"}],"break_after_line":[0]}"#;
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(out.content_contract_valid);
    assert!(out.contract_fallback_line_indices.is_empty());
    assert_eq!(out.punct_lines, vec!["你好", "世界。"]);
    assert_eq!(out.break_after_line, vec![0]);
    let paras = paragraphs_from_break_after(&out.punct_lines, &out.break_after_line);
    assert_eq!(paras, vec!["你好", "世界。"]);
}

#[test]
fn parse_accepts_fenced_json_and_camel_case_breaks() {
    let raw = "```json\n{\"items\":[{\"id\":1,\"text\":\"乙。\"},{\"id\":0,\"text\":\"甲\"}],\"breakAfterLine\":[0]}\n```";
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(out.content_contract_valid);
    assert_eq!(out.punct_lines, vec!["甲", "乙。"]);
    assert_eq!(out.break_after_line, vec![0]);
}

#[test]
fn parse_ignores_trailing_prose_after_json() {
    let raw = r#"{"items":[{"id":0,"text":"句一"},{"id":1,"text":"句二。"}],"break_after_line":[]}

以上已完成润色。"#;
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(out.content_contract_valid);
    assert_eq!(out.punct_lines.len(), 2);
}

#[test]
fn parse_rejects_missing_item_id() {
    let rows: Vec<serde_json::Value> = (0..175)
        .map(|id| serde_json::json!({ "id": id, "text": format!("行{id}") }))
        .collect();
    let raw = format!(
        r#"{{"items":{},"break_after_line":[]}}"#,
        serde_json::to_string(&rows).unwrap()
    );
    let out = parse_export_polish_json(&raw, 176).unwrap();
    assert!(!out.content_contract_valid);
    assert!(out.punct_lines.is_empty());
}

#[test]
fn parse_rejects_duplicate_out_of_range_and_empty_items() {
    for raw in [
        r#"{"items":[{"id":0,"text":"甲"},{"id":0,"text":"乙"}]}"#,
        r#"{"items":[{"id":0,"text":"甲"},{"id":2,"text":"乙"}]}"#,
        r#"{"items":[{"id":0,"text":"甲"},{"id":1,"text":"  "}]}"#,
    ] {
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert!(!out.content_contract_valid);
        assert!(out.punct_lines.is_empty());
    }
}

#[test]
fn parse_treats_malformed_item_fields_as_invalid_contract() {
    for raw in [
        r#"{"items":[{"text":"甲"},{"id":1,"text":"乙"}]}"#,
        r#"{"items":[{"id":-1,"text":"甲"},{"id":1,"text":"乙"}]}"#,
        r#"{"items":[{"id":"0","text":"甲"},{"id":1,"text":"乙"}]}"#,
        r#"{"items":[{"id":0,"text":null},{"id":1,"text":"乙"}]}"#,
    ] {
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert!(!out.content_contract_valid);
        assert!(out.punct_lines.is_empty());
    }
}

#[test]
fn export_polish_prompt_accepts_custom_template() {
    let custom = r#"润色 {line_count} 行。{batch_note}{rule_hints}
输出 {"lines":["..."]}：
{body}"#;
    let p = build_export_polish_prompt("a\nb", 2, "规则A", "", None, Some(custom));
    assert!(p.contains("润色 2 行"));
    assert!(p.contains(r#"{"id":0,"text":"a"}"#));
    assert!(p.contains(r#"{"id":1,"text":"b"}"#));
    assert!(p.contains("规则A"));
    assert!(p.contains("客户端强制输出契约"));
    assert!(p.contains("最终必须只输出 JSON"));
    assert!(p.rfind("最终必须只输出 JSON").unwrap() > p.rfind("输出 {\"lines\"").unwrap());
}

#[test]
fn export_polish_template_reports_missing_placeholders() {
    let err = validate_export_polish_instructions_template("只润色 {body}").unwrap_err();
    assert!(err.contains("{line_count}"));
    assert!(err.contains("{batch_note}"));
    assert!(err.contains("{rule_hints}"));
}

#[test]
fn prompt_mentions_break_after_only() {
    let p = build_export_polish_prompt("a\nb", 2, "", "", None, None);
    assert!(p.contains("break_after_line"));
    assert!(p.contains("不得缺失、重复、换号或合并"));
    assert!(p.contains("只允许调整标点与空白"));
    assert!(p.contains("300"));
    assert!(p.contains("错误标点"));
    assert!(p.contains("顿号"));
}

#[test]
fn prompt_and_system_prompt_forbid_body_changes() {
    let p = build_export_polish_prompt("a\nb", 2, "", "", None, None);
    assert!(p.contains("必须逐字保留"));
    assert!(!p.contains("大胆纠正"));
    assert!(p.contains(r#"{"id":0,"text":"a"}"#));
    let sys = default_export_polish_system_prompt();
    assert!(sys.contains("必须完整、唯一地返回"));
    assert!(sys.contains("禁止改动、增删任何正文字符"));
    let custom_sys = resolve_export_polish_system_prompt(Some("请输出 lines"));
    assert!(custom_sys.contains("请输出 lines"));
    assert!(custom_sys.contains("客户端强制契约"));
    assert!(custom_sys.contains("禁止 lines"));
}

#[test]
fn prompt_injects_glossary_hints_independent_of_rule_hints() {
    let p = build_export_polish_prompt("a\nb", 2, "「错」→「对」", "术语甲\n术语乙", None, None);
    assert!(p.contains("项目专名/术语词表"));
    assert!(p.contains("术语甲\n术语乙"));
    assert!(p.contains("已应用的稳定纠错规则"));
    assert!(p.contains("「错」→「对」"));
    assert!(p.contains("不得据此替换文字"));
    assert!(p.contains("不得再次修改正文"));
    assert!(!p.contains("须在对应行落实"));
}

#[test]
fn prompt_omits_glossary_section_when_empty() {
    let p = build_export_polish_prompt("a\nb", 2, "「错」→「对」", "", None, None);
    assert!(!p.contains("项目专名/术语词表"));
    assert!(p.contains("已应用的稳定纠错规则"));
}

#[test]
fn parse_json_array_of_lines() {
    let raw = r#"["句一","句二。"]"#;
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(!out.content_contract_valid);
    assert_eq!(out.punct_lines, vec!["句一", "句二。"]);
    assert!(out.break_after_line.is_empty());
}

#[test]
fn parse_empty_legacy_lines_as_invalid_contract_instead_of_error() {
    for raw in [r#"{"lines":[]}"#, r#"[]"#] {
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert!(!out.content_contract_valid);
        assert!(out.punct_lines.is_empty());
    }
}

#[test]
fn parse_plain_newline_lines_fallback() {
    let raw = "句一\n句二。";
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(!out.content_contract_valid);
    assert_eq!(out.punct_lines, vec!["句一", "句二。"]);
}

#[test]
fn parse_after_think_block() {
    let raw = r#"推理中…
{"items":[{"id":0,"text":"甲"},{"id":1,"text":"乙。"}],"break_after_line":[0]}"#;
    let out = parse_export_polish_json(raw, 2).unwrap();
    assert!(out.content_contract_valid);
    assert_eq!(out.punct_lines, vec!["甲", "乙。"]);
    assert_eq!(out.break_after_line, vec![0]);
}

#[test]
fn plan_batches_splits_over_threshold() {
    let lines: Vec<String> = (0..150).map(|i| format!("行{i}")).collect();
    let body = lines.join(&EXPORT_POLISH_LINE_SEPARATOR.to_string());
    let batches = plan_export_polish_batch_bodies(&body);
    assert_eq!(batches.len(), 2);
    assert_eq!(count_body_lines(&batches[0]), 100);
    assert_eq!(count_body_lines(&batches[1]), 50);
}

#[test]
fn split_batch_body_halves_lines() {
    let body = format!(
        "a{}b{}c{}d",
        EXPORT_POLISH_LINE_SEPARATOR, EXPORT_POLISH_LINE_SEPARATOR, EXPORT_POLISH_LINE_SEPARATOR
    );
    let (left, right) = split_export_polish_batch_body(&body).unwrap();
    assert_eq!(count_body_lines(&left), 2);
    assert_eq!(count_body_lines(&right), 2);
}

#[test]
fn retriable_errors_cover_truncate_and_parse() {
    assert!(export_polish_error_is_retriable(
        "x 模型输出被截断（finish_reason=length，max_tokens=1024）"
    ));
    assert!(export_polish_error_is_retriable(
        "模型未返回可解析的 JSON（需 items + break_after_line）：eof"
    ));
    assert!(!export_polish_error_is_retriable("大模型润色请求已取消。"));
    assert!(!export_polish_error_is_retriable("LLM 未配置。"));
}

#[test]
fn lines_from_body_preserves_in_segment_newlines() {
    let body = format!("a{}b\nc", EXPORT_POLISH_LINE_SEPARATOR);
    assert_eq!(lines_from_export_polish_body(&body), vec!["a", "b\nc"]);
    assert_eq!(count_body_lines(&body), 2);
}

#[test]
fn invalid_contract_falls_back_the_whole_batch_to_originals() {
    let batch = format!("甲{}乙", EXPORT_POLISH_LINE_SEPARATOR);
    let mut parsed = ExportPolishParsed {
        punct_lines: vec!["甲。".to_string()],
        content_contract_valid: false,
        contract_fallback_line_indices: vec![],
        break_after_line: vec![0],
    };
    fallback_invalid_batch_to_originals(&mut parsed, &batch);
    assert_eq!(parsed.punct_lines, vec!["甲".to_string(), "乙".to_string()]);
    assert_eq!(parsed.contract_fallback_line_indices, vec![0, 1]);
    assert!(parsed.break_after_line.is_empty());
}

#[test]
fn plan_batches_single_under_threshold() {
    let body = "a\nb\nc";
    let batches = plan_export_polish_batch_bodies(body);
    assert_eq!(batches.len(), 1);
    assert_eq!(count_body_lines(&batches[0]), 3);
}

#[test]
fn merge_batches_offsets_breaks_and_skips_boundary() {
    let b0 = ExportPolishParsed {
        punct_lines: vec!["a".into(), "b".into()],
        content_contract_valid: true,
        contract_fallback_line_indices: vec![],
        break_after_line: vec![0, 1],
    };
    let b1 = ExportPolishParsed {
        punct_lines: vec!["c".into()],
        content_contract_valid: false,
        contract_fallback_line_indices: vec![0],
        break_after_line: vec![],
    };
    let merged = merge_export_polish_batches(vec![b0, b1], &[2, 1]);
    assert_eq!(merged.punct_lines, vec!["a", "b", "c"]);
    assert!(!merged.content_contract_valid);
    assert_eq!(merged.contract_fallback_line_indices, vec![2]);
    assert_eq!(merged.break_after_line, vec![0]);
}
