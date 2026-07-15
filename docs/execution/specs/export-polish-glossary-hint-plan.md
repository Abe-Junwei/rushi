# 导出润色注入术语表（glossary） — 调研 + Plan

> **状态**：规划门禁 → 待实施
> **门禁**：本文兼作调研 brief（§0）与落位 Plan（§1+），编码前已完成，符合 `.cursor/rules/feature-research-gate.mdc`

---

## §0 调研

### 0.1 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户在“导出交付 · 干净稿/讲义稿”勾选大模型润色时，希望专名/术语（词表 canonical）写法与「智能改稿」阶段一致；当前导出润色仅注入纠错规则，未注入词表 |
| 本仓现状 | Stage B 智能改稿（`postprocess_lexicon_ops/prompt.rs::build_stage_b_merged_proofread_prompt`）从 `assemble_lexicon_pack` 读取 `glossary_canonical` + `correction_rules` 一并注入 prompt。导出润色（`postprocess_export_polish.rs::build_export_polish_prompt`）只接收 TS 侧组装的 `rule_hints`（来自 `correctionStableRulesList()` + `buildExportPolishRuleHints`），未读取 `glossary_terms` |
| 成功标准 | 导出润色 prompt 中出现术语表 canonical 列表；单元测试覆盖 prompt 拼装；不改变现有 `{rule_hints}` 等模板占位符契约（用户自定义 `export_polish_instructions` 模板不失效） |

### 0.2 业内对照

导出润色是本仓内部 LLM 纠错/分段管线，非独立行业能力；直接对照物是**同仓内 Stage B 已验证的落地路线**（词表注入到 prompt，供 LLM 参考纠正专名/同音字），而非外部第三方产品：

| # | 路线 | 核心机制 | 复用度 |
|---|------|----------|--------|
| A | Stage B 词表注入（本仓已上线） | `glossary_canonical` 列表 + 纠错规则一并写入 prompt 前言，LLM 据此纠字并给 evidence | 高（直接复用格式风格） |
| B | 确定性字符串替换（导出润色纠错规则的 TS 侧 `applyRulesToSegmentLines` 已用） | LLM 输出后按 `wrong→right` 表做无条件替换 | 低（glossary 是 canonical 词条，非 wrong→right 映射，无法确定性替换） |

### 0.3 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 冲突 | 备注 |
|------|--------|----------------|------|------|
| A | 高 | prompt 文案风格（“词表 canonical” 段落）；TS 侧已有 `glossaryList()` API | 无 | 仅需新增一段独立 hint 文本，塞进现有 `{rule_hints}` 占位符内容中，不新增模板占位符 |
| B | 低 | — | glossary 无 wrong/right 结构 | 不采用 |

**本仓已有可复用模块**：
- `apps/desktop/src/tauri/glossaryApi.ts::glossaryList()` — 已有的术语查询 API（TS 侧，导出润色本就是 TS 编排 + Rust HTTP 调用）
- `apps/desktop/src/services/exportPolishRuleHints.ts::buildExportPolishRuleHints()` — 现有纠错规则 hint 拼装范式，新函数镜像其结构
- `apps/desktop/src-tauri/src/postprocess_export_polish.rs::build_export_polish_prompt()` — 现有 prompt 拼装函数，新增一个 `glossary_hints: &str` 参数

### 0.4 决策

| 问题 | 结论 |
|------|------|
| 选定方案 | 路线 A：TS 侧新增 `buildExportPolishGlossaryHints()`，用 `glossaryList()` 结果组装 canonical 列表文本；经新增请求字段 `glossaryHints` 传到 Rust；`build_export_polish_prompt` 新增 `glossary_hints` 参数，与现有 `rule_hints` 一起拼进 **同一个** `{rule_hints}` 模板占位符（各自独立措辞小节），不新增模板占位符 |
| 不做什么 | 不对 glossary 做确定性字符串替换（无 wrong→right 语义）；不复用 Rust `assemble_lexicon_pack`（导出润色管线本就是 TS 编排 + 规则走 `correctionStableRulesList()`，非 Rust 直读 DB；为保持该管线现状一致性，glossary 同样由 TS 侧 `glossaryList()` 提供，不引入第二条 DB 读取路径） |
| 与 ADR / architecture 关系 | 不涉及新架构；沿用既有 `postprocess_export_polish` 单文件 prompt 拼装模块 |
| 风险 | 词条数量大时 prompt 变长 → 复用 Stage B 同量级上限（≤200 条），且导出润色本身已有分批与 `MAX_EXPORT_POLISH_INPUT_CHARS` 兜底 |

### 0.5 落位预告

| 层 | 文件 | 变更类型 |
|----|------|----------|
| Rust | `postprocess_export_polish.rs` | `build_export_polish_prompt` 新增 `glossary_hints` 参数；内部拼装独立措辞小节 |
| Rust | `postprocess_export_polish_cmd.rs` | 请求结构体新增 `glossary_hints: Option<String>`；沿调用链传递 |
| TS | `tauri/postprocessApi.ts` | `PostprocessExportPolishRequest` 新增 `glossaryHints?: string` |
| TS | 新增 `services/exportPolishGlossaryHints.ts` | `buildExportPolishGlossaryHints(terms)` |
| TS | `services/exportDocxPolish.ts` | `fetchExportPolishResult` 并行拉取 `glossaryList()`，组装后随请求发送 |
| 测试 | Rust `postprocess_export_polish.rs` 内 `mod tests`；新增 `exportPolishGlossaryHints.test.ts` | 覆盖 prompt 拼装与 hint 组装 |

---

## §1 Plan（落位细节）

1. `postprocess_export_polish.rs::build_export_polish_prompt(body, line_count, rule_hints, glossary_hints, batch, instructions_override)` —— 在现有 `hints` 拼装逻辑前，先拼一段 glossary 小节（措辞：“项目专名/术语词表（如遇疑似同音、形近误写且与下列词条相符，请改为词条写法）：”），两段落非空时用空行分隔，整体仍替换进模板里唯一的 `{rule_hints}` 占位符 —— **零模板契约变更**，用户自定义 `export_polish_instructions` 不受影响。
2. `postprocess_export_polish_cmd.rs`：请求体新增 `glossary_hints: Option<String>`；`run_export_polish_batch` / `run_export_polish_batch_once` 新增同名参数直传 `build_export_polish_prompt`。
3. `postprocessApi.ts` 请求类型新增 `glossaryHints?: string`（camelCase，走现有 serde `rename_all = "camelCase"`，无需手工转换）。
4. 新文件 `exportPolishGlossaryHints.ts`：`buildExportPolishGlossaryHints(terms: GlossaryTermDto[]): string`，去重/去空后按 `term` 升序、上限 200 条，逐行 `- 术语`。
5. `exportDocxPolish.ts::fetchExportPolishResult`：`Promise.all([correctionStableRulesList(), glossaryList()])` 并行拉取；组装 `glossaryHints` 并放入请求。
6. 验证：`cargo test -p rushi-desktop postprocess_export_polish`、`npm run typecheck`、`npm run test -- exportPolishGlossaryHints exportDocxPolish`。

**能力—UI 状态矩阵**：不涉及新 UI 状态；导出润色开关行为不变，仅 prompt 内容增强，用户侧无可见状态位新增。

---

## §2 架构守卫例外登记

`apps/desktop/src-tauri/src/postprocess_export_polish.rs` 在本任务前已为 634 行（超过 `.rs > 500 行` 拆分阈值，`check-architecture-guard.mjs` 报 `建议拆分模块`），本任务新增 `glossary_hints` 参数 + 2 条测试后为 659 行。鉴于：

- 该 warning 为**任务前既有**（非本次改动新引入的越界），本次仅净增 ~25 行；
- 文件内生产代码（prompt 拼装/解析，约 1–455 行）与测试代码（约 457–659 行）已用 `#[cfg(test)] mod tests` 清晰分区；
- 本任务范围为小步 surgical 变更，不适合借机做无关的模块拆分（避免扩大 diff、引入拆分期间的回归风险）；

登记为**暂时例外**，回收计划：下次touch该文件的功能性改动（或专项架构体检）时，将 `mod tests` 抽到同目录 `postprocess_export_polish/tests.rs`（或拆出 `postprocess_export_polish_parse.rs` 承载 `parse_export_polish_json` 等解析逻辑），使生产代码回落到阈值内。
