# EXP-WORD 交付导出 Word 代码审查报告

> **审查日期**：2026-06-03（覆写）  
> **关联**：[acceptance](./exp-word-formatted-export-acceptance.md) · 路线图 §4.1.1 ⑤‴  
> **审查范围**：Rust `export_docx.rs`、`export_docx_polish_track.rs`、`postprocess_export_polish.rs`、`postprocess_cmd.rs`；TS `exportDocxPolish.ts`、`exportPolishPipeline.ts`、`exportPolishParagraphs.ts`、`exportPolishHygiene.ts`、`exportPolishPreviewCache.ts`、`exportPolishDiagnostics.ts`、`exportPolishRevision.ts`、`useExportController.ts`、`DeliveryExportDialog.tsx`  
> **验证**：`tsc --noEmit` 通过；Vitest exportPolish/exportDocxPolish **22** 项通过；`cargo test export_track`、`build_docx_bytes_produces_zip_container` 通过  
> **Epic 状态**：🟡 编码中（acceptance 手测项未勾选）

---

## 执行摘要

| 维度 | 结论 |
|------|------|
| 架构 | TS 润色编排 → Rust DOCX 组装 → ZIP 补丁 `settings.xml`，职责清晰 |
| 最大技术债 | **预览 `hasTrackChange`（行级）≠ Word 修订（hunk 级）**；长文 LLM **无取消、30s 超时** |
| 最大正确性风险 | **`escape_docx_text` 与 docx-rs 内置转义叠用**可能导致 `&amp;amp;`；**XML 非法控制字符**仍未过滤 |
| 产品行为 | 「正文已润色、修订很少」多为 **`filter_char_diff_hunks_*` 设计**，非 Pandoc/Word 故障 |

---

## 一、严重缺陷（P0 — 可能导致损坏、打不开或交付错误）

### 1. `escape_docx_text` 与 docx-rs 双重转义（正文/元数据）

**位置**：`export_docx.rs:15-27` + `add_body_paragraph` / `add_meta_paragraph`（经 `Run::add_text`）

`docx-rs` 的 `Text::new` / `DeleteText::new` 已调用 `escape()`（`& < > " '` + `\n`→`&#xA;`），见 `docx-rs` `escape/mod.rs`、`run.rs:160-177`。

当前路径：

```rust
Run::new().add_text(escape_docx_text(text))  // 先转义一次
// → docx-rs 再 escape 一次
```

对含 `&`、`<` 的语段，XML 中可能出现 **`&amp;amp;`**，Word 显示为字面量 `&amp;` 而非 `&`。

**修订轨**：`paragraph_from_diff_pieces` 直接 `add_text` / `add_delete_text`，**仅一层转义** — 与正文路径不一致。

**修复建议**（二选一）：

- 正文路径改为 `add_text(text)`，删除 `escape_docx_text` 包装；或
- 修订轨与正文统一：要么全交给 docx-rs，要么全用 `add_*_without_escape` + 单一 `escape_docx_text` 真源。

---

### 2. XML 非法控制字符未过滤

**位置**：`escape_docx_text`（若保留）或入库/导出前卫生层

`docx-rs` `escape()` **不丢弃** `\x00-\x1F`（除 `\n`/`\r` 处理外）等 XML 1.0 非法码点。恶意或损坏语段文本可能导致 Word 报错或静默丢字。

**修复建议**：在导出前统一 `sanitize_xml_text(ch)` 丢弃非法码点；补 fixture 测试（含 `\x00`、`\uFFFE`）。

---

### 3. `postprocess_export_polish` 无取消 + 超时过短

**位置**：`postprocess_cmd.rs:789-909`

| 对比项 | `postprocess_auto_punctuate` 等 | `postprocess_export_polish` |
|--------|--------------------------------|-----------------------------|
| `AbortHandle` / `postprocess_cancel_*` | 有 | **无** |
| HTTP timeout | 30s | 30s（硬编码 `DEFAULT_TIMEOUT_SECS`） |

- 12 万字符讲稿润色常需 **60–120s**，30s 易误报失败。
- 预览加载中用户无法取消，只能关对话框（`previewLoading` 阻止关闭需等超时）。

**修复建议**：复用 `PostprocessCancelState`；超时按 `body.chars().count()` 分段（如 `min(120, 30 + chars/2000)`）；`DeliveryExportDialog` 增加「取消预览」并调用 cancel command。

---

## 二、高危缺陷（P1 — 错误结果、性能、体验）

### 4. 预览与 Word 修订轨规则不一致（产品/可维护性）

| 层 | 规则 | 文件 |
|----|------|------|
| 预览 `hasTrackChange` | **整行** `lineEligibleForExportTrack` | `exportPolishPipeline.ts:171-181` |
| Word 修订 | **hunk** `hunk_eligible_for_export_track` + `filter_char_diff_hunks_*` | `export_docx_polish_track.rs:168-250` |

长行内多处错字 + LLM 整句调整时：预览可能显示「会修订」，Word 仅少量 `w:ins`/`w:del`（定稿正文仍为润色后文本）。属**已知产品策略**，但 UI 易误判为 bug。

**修复建议**：

- 预览改为按 hunk 统计或标注「部分修订」；或
- TS 移植与 Rust 相同的 hunk 规则（共享测试 fixture）。

---

### 5. `append_polished_with_track_changes` 空 bucket → 仅定稿、无修订

**位置**：`export_docx_polish_track.rs:536-540`

```rust
if pieces_have_markup(bucket) {
    paragraph_from_diff_pieces(...)
} else {
    add_body_paragraph(doc, &chunk, false)  // 润色后正文，无 w:ins/w:del
}
```

与 #4 联动：bucket 空不等于「无改动」，而是「改动被过滤或未归入 bucket」。

**次要风险**：`display_paragraphs_from_lines` 与 `accumulate_line_diffs_into_paragraphs` 按扁平字符映射；段合并后 `char_para` 与 `corrected_lines` 字序不完全一致时，修订可能挤在段首/段尾。

---

### 6. `should_use_polish_track_changes` 行数门禁 → 静默降级

**位置**：`export_docx.rs:220-241`

`corrected_lines.len() != before_lines_from_joined(before).len()` 时整篇走 `append_polished_paragraph_list`，**无任何修订**。对齐失败时用户无提示（仅 diagnostic 可能有行数说明）。

**修复建议**：降级时写日志或导出元数据行「未启用修订轨（行数未对齐）」。

---

### 7. `diff_edit_ops` LCS 内存与超长行

**位置**：`export_docx_polish_track.rs`（`n*m > 2_500_000` 回退单区间）

- `reconcileLlmPolishLines` 在 LLM 多行时可能拼出**超长 tail**（`exportPolishPipeline.ts:82-86`），diff 成本高。
- `Vec<Vec<u32>>` 分配在阈值附近仍可达约 **9MB+**。

**修复建议**：tail 合并长度上限 + 诊断警告；LCS 改滚动数组；对单行 > N 字强制走 `diff_edit_ops_single_interval`。

---

### 8. TS / Rust 正文长度计数不一致

| 侧 | 规则 |
|----|------|
| TS `resolveExportPolishBlockReason` | `body.length`（UTF-16 code units） |
| Rust `postprocess_export_polish` | `body.chars().count()`（Unicode scalar） |

含 surrogate pair 的 emoji 时，阻断阈值可能不一致。

**修复建议**：TS 改为 `Array.from(body).length` 或与 Rust 一致的 scalar 计数。

---

### 9. `tryAdoptExportPolishPreview` 引用相等与冗余分支

**位置**：`exportPolishPreviewCache.ts:47-59`

- 缓存命中且 `polishPreview === entry.result`（**同一引用**）才在首分支返回；若 UI 重建了内容相同的新对象，会落到 `null` 并**重复请求 LLM**。
- 第二 `if (polishPreview && entry?...)` 与首分支部分重复，可读性差。

**修复建议**：指纹匹配时优先 `polishPreview ?? entry.result`；为「同指纹不同引用」补测试。

---

### 10. `inject_track_revisions_flag` ZIP 重写

**位置**：`export_docx_polish_track.rs:585-616`

- 全部条目 `Deflated`，可能改变原 `Stored` 条目。
- `patch_settings_track_and_markup` 用 `contains("trackRevisions")` 字符串匹配，无法把 `w:val="false"` 改为 true。

**修复建议**：保留 per-entry `compression()`；用轻量 XML 解析改 `trackRevisions`。

---

## 三、中危缺陷（P2）

### 11. `llmHanEditRatio` 恒为 0

`exportPolishDiagnostics.ts:73` — 字段占位，诊断「行级改写比例」无效。应实现或从类型删除。

### 12. `paragraphs_from_break_after`（Rust）与 TS 分段双实现

Rust `postprocess_export_polish.rs:48-77` 与 TS `exportPolishParagraphs.ts` 逻辑相近；当前导出路径以 **TS `paragraphs` + `coalesceExportParagraphBreaks`** 为准，Rust 函数为死代码（`dead_code` 警告）。应删除或单一真源。

### 13. `format_hms` 对 `Infinity` 的 UB 风险

`seconds.max(0.0).floor() as u64`：若 `seconds` 为 `+Infinity`，`as u64` 为未定义行为。应 `seconds.is_finite()` 守卫。

### 14. `export_docx` 同步 command + 阻塞对话框

`export_docx.rs:327-375`：`rfd` + `fs::write` 在 command 线程同步执行，大包体时可能卡 UI。

### 15. `applyStableRulesToPolishLines` 全局 `split/join` 连锁替换

`exportPolishFinalize.ts` — 规则 `("aa"->"b")` 于 `"aaa"` 等边界可能过度替换。已有长度降序，仍建议非重叠替换或单次扫描。

### 16. 附录行数 TS/Rust 不一致

TS `buildDeliveryExportAppendixLines` 约 90 行上限；Rust `MAX_APPENDIX_LINES = 120`。非功能性 bug，宜文档化或统一常量。

### 17. `exportPolishRevision.ts` 未接入导出主路径

提供 `buildExportPolishEditLogDetail` / `buildExportPolishRevisionLines`，但 `useExportController` 未调用；与 acceptance「润色修订轨 vs edit_log 附录」并存时需避免重复叙事或明确接线。

### 18. DOCX 颜色与 DESIGN .token

`highlight("yellow")`、`DOCX_COLOR_MUTED` 硬编码于 Rust；宜集中为 `docx_export_tokens.rs` 或与 `tokens.ts` 注释对齐的具名常量。

---

## 四、低危与测试缺口（P3）

### 19. 测试覆盖（当前）

| 已有 | 缺口 |
|------|------|
| exportPolish* / exportDocxPolish Vitest 22 项 | `useExportController` 错误恢复、busy 泄漏 |
| Rust `export_track_*`、`build_docx_bytes` zip | XML 实体双转义、控制字符、`\r\n` joined、emoji diff |
| `exportPolishPreviewCache` 3 项 | 同指纹不同引用 adopt |

### 20. 缓存无 TTL

`exportPolishPreviewCache` 单例 + 指纹；关对话框会 `clear`。长时间不关对话框仅改 hygiene rev 会失效，一般可接受。

### 21. 指纹碰撞

`djb2` 32 位 + 行数 + `EXPORT_POLISH_HYGIENE_REV`；极低概率碰撞，可选加 `body.length`。

### 22. acceptance 未勾选

见 [exp-word-formatted-export-acceptance.md](./exp-word-formatted-export-acceptance.md) 五项；修复 P0/P1 后须手测讲稿润色 + 修订显示模式。

---

## 五、已修复 / 已验证项（相对初版报告）

| 初版声称 | 覆写结论 |
|----------|----------|
| 修订轨 `add_text` 未转义 | **docx-rs 已转义**；问题转为正文路径**双转义**（#1） |
| 整行 diff 为空则无修订 | 已增加 **hunk 级** `filter_char_diff_hunks_for_export_track` + 测试 `export_track_keeps_typo_hunks_in_long_line` |
| `tryAdopt` 完全错误 | 逻辑基本正确；**引用相等**边界仍存（#9） |

---

## 六、修复优先级

| 优先级 | 编号 | 内容 | 估时 |
|--------|------|------|------|
| P0 | 1, 2 | 转义单一真源 + XML 非法字符 | 1.5h |
| P0 | 3 | 润色取消 + 动态超时 | 2h |
| P1 | 4, 5 | 预览与修订规则对齐或文案 | 2h |
| P1 | 6, 9, 10 | 修订降级提示、缓存 adopt、settings XML | 2h |
| P1 | 7, 8 | LCS/tail 防护、长度计数对齐 | 1.5h |
| P2 | 11-18 | 诊断、死代码、Infinity、附录、token | 3h |
| P3 | 19-22 | 测试与 acceptance 手测 | 4h |

---

## 七、总体评价

**可合并方向**：核心链路可工作，自动化测试覆盖润色管线主干；修订轨 hunk 过滤与产品 acceptance 一致。

**交付前必须**：P0（转义、非法字符、LLM 超时/取消）；P1 中预览与 Word 修订一致性（或明确 UI 文案）；acceptance 手测三项形态 + 讲稿润色修订目检。

**不建议**：用 Pandoc 替代当前 `docx-rs` 修订写入（见对话调研结论）；问题在分类策略与编排，不在 OOXML 生成器选型。

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-03 | 初版 |
| 2026-06-03 | 覆写：对照 docx-rs 转义行为、hunk 修订实现、测试通过与优先级调整 |
