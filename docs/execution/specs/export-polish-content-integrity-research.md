# 调研：干净稿 LLM 润色正文完整性

> **状态**：已确认实施（2026-08-06）  
> **问题**：LLM 在导出润色时删句/改写，旧编辑距离门禁仍可能放行，导致干净稿正文静默缺失。  
> **落位**：`postprocess_export_polish.rs` / `postprocess_export_polish_cmd.rs` / `exportPolishPipeline.ts` / `exportDocxPolish.ts`

## 1. 成功标准

- LLM 缺行、并行、重复行、整句删除、等长改写时，最终正文不得静默丢失。
- 每批输入语段使用稳定 ID 回收；禁止按返回数组位置猜测对应关系。
- 本地稳定纠错规则是可信正文改写源；LLM 只可改变标点和自然段边界。
- 任一批次 ID 契约异常时，正文按该批输入回退；导出仍可完成。
- Word 修订轨只展示差异，不承担正文恢复责任。

## 2. 成熟路线对照

| 路线 | 证据 | 可复用结论 |
|---|---|---|
| DeepSeek JSON Output | [官方文档](https://api-docs.deepseek.com/guides/json_mode/)说明 `json_object` 保证合法 JSON，但仍要求 prompt 给出结构，且可能返回空内容 | JSON 可解析不等于 ID/语义正确；必须本地验证缺失、重复、越界 ID |
| OpenAI Structured Outputs | [官方指南](https://platform.openai.com/docs/guides/structured-outputs)区分严格 JSON Schema 与旧 JSON mode | Provider 支持时可增强结构约束，但不能替代正文业务不变量 |
| Anthropic Structured Outputs | [官方文档](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)以 JSON Schema 约束结构 | 跨 Provider 共同模式是“结构化输出 + 本地校验”；本仓不能依赖单一 Provider 特性 |
| 稳定关联键 | OpenAI Batch API 的 [`custom_id`](https://platform.openai.com/docs/api-reference/batch/object)用于将乱序输出映射回输入 | 语段润色采用稳定 `id`，而非数组位置或模糊文本对齐 |

## 3. 方案评估

| 方案 | 完整性 | 代价 | 结论 |
|---|---:|---:|---|
| Prompt 加强“禁止删句” | 低 | 低 | 仅保留提示，不作门禁 |
| 净删/LCS/全文覆盖率阈值 | 中 | 中 | 可作诊断，不足以证明无丢字；短句、重复句、等长改写仍有漏洞 |
| 稳定 ID + 小改阈值 | 高 | 中 | 可防错位，但仍允许少量正文删除 |
| **稳定 ID + 可信正文投影** | **最高** | 中 | **采用**：规则先行，LLM 只采纳标点；异常按 ID/批次回退 |

## 4. 决策

1. 请求正文先应用本地稳定纠错规则，形成 `trustedLines`。
2. Rust 给每批语段分配从 0 开始的稳定批内 ID；LLM 返回 `items: [{id,text}]` 与 `break_after_line`。
3. Rust 宽松读取 JSON 字段、严格校验业务契约；缺字段、错类型、负数、重复、越界或空正文均不得变成解析中止。
4. Rust 不再按位置补尾或合并。契约异常时该批正文整体回退，并回传对应的全文语段下标；坏批分段建议同时丢弃。
5. 客户端只回退这些坏批下标，其他合法批次仍可采纳标点；对每条候选文本，仅当 `stripForPunctCompare(after) === stripForPunctCompare(trusted)` 时采纳。
6. 默认 Prompt 与用户自定义 Prompt 后都追加不可覆盖的 `items/id/text` 输出契约；词表与规则提示只能辅助断句，不得诱导正文替换。
7. 最终硬断言：行数一致，且每行去标点正文与可信正文一致。失败则整稿回退可信正文，仅保留安全段落边界。

## 5. 不做什么

- 不用编辑距离、净删字数或 85% LCS 作为正文安全真源。
- 不让 DOCX 修订轨补救上游缺字。
- 不要求所有 Provider 支持 JSON Schema；DeepSeek `json_object` 路径继续兼容。
- 不在本薄片改变交付导出模式或 UI 流程。

## 6. 验证

- 前端：事故样本、短句等长改写、混合批次、规则替换、标点采纳、诊断归因。
- Rust：ID 解析、字段缺失/错类型/负数/重复/越界、分批 offset、legacy Prompt 强制契约与返回 fail-closed。
- 全链：`correctedLines` 与 `trustedLines` 去标点正文逐行相等；DOCX 正文不依赖修订轨恢复。
