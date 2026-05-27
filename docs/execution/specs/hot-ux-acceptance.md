# Acceptance: HOT-UX — 热词 12k 截断可观测

> **状态**：✅ 编码 + 单测（2026-05-27）；手测可选  
> **路线图**：§4.1.1 **⑤½**（Q-R3t-3）  
> **真源**：[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)

## 范围

- 术语库 → 空格串 `hotwords`（仅 `hotword_enabled=1` 词条；别名拆 token；跨词条去重），上限 **12,000 字符**（Tauri 构建 + 侧车二次防护）。
- **术语库页**：「本次转写将携带」摘要（纳入词条数、唯一 token 数、字符、是否截断、预览片段）；`hotword_enabled` 可逐条/批量切换；批量选择与删除。
- **导入/导出**：CSV 往返含 `hotword_enabled` 列；结构化表头导入保留别名/领域/备注。
- **转写后**：`warnings` 含 `hotwords_truncated_12k` 时，`deriveTranscribeHints` 给出可读说明。

## 验收

- [x] `glossary_hotwords_preview` 返回 `enabledEntryCount` / `truncated` / `droppedTermCount` 等
- [x] `glossary_delete_batch` / `glossary_set_hotword_batch` / `glossary_add_batch`
- [x] 热词构建跨词条 token 去重（Rust unit）
- [x] `project_run_transcribe` 在桌面截断时注入 `hotwords_truncated_12k`
- [x] `GlossaryPage`：热词筛选、半选 checkbox、筛选变更清空选择、全选筛选结果
- [x] Vitest：`glossaryHotwords.test.ts`、`glossaryTermHelpers.test.ts`、`asrTranscribeHints` 截断用例
- [x] Rust unit：`glossary_hotwords` / `glossary_structured_import` / 批量 SQL
- [x] Excel 粘贴与 `.xlsx`/`.csv` 导入（含结构化 CSV 的 hotword_enabled）
- [x] 大量术语不闪退：热词增量拼接；列表仅渲染前 200 条
- [ ] 手测（可选）：全部移出热词 → 摘要 0 token；跨词条重复 alias → 占用不重复计算

## 非范围

- LLM LexiconPack（R3t-E）
- 在线 STT 各厂商热词字段差异（仅本地 multipart `hotwords` 为主路径）
