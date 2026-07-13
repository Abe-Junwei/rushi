# Acceptance: EXP-WORD — 定稿 Word 格式化导出（L6）

> **状态**：✅ **功能验收通过**（2026-06-03）· EXP-WORD-1～5 v1  
> **排期**：路线图 §4.1.1 **⑤‴**（R3t-E 之后、R4 之前）  
> **Backlog**：[`word-formatted-export-backlog.md`](./word-formatted-export-backlog.md)  
> **审查**：[`exp-word-code-review-report.md`](./exp-word-code-review-report.md)  
> **基线**：P3 [`p3-acceptance.md`](../p3-acceptance.md) 已有最小 DOCX — **本 Epic 为交付版式收口**

## 目标

用户完成 **ASR +（可选）LLM + 人工校对** 后，导出 Word：**版式稳定**、与编辑器语段一致，可选 **修订摘要附录**；**不等**协作 C6。

## 范围

### 做（v1）

| # | 形态 | 说明 |
|---|------|------|
| 1 | **逐字稿** | 时间码 + 正文；样式用 token/命名样式，禁止 arbitrary hex |
| 2 | **讲稿** | 默认按语段自然段；可选 **大模型润色**（仅明显错别字与错误标点；**Word 修订轨**同范围；语义合并自然段且单段约 ≤300 字；**导出时直接润色生成终稿，无需预览**） |
| 3 | **干净稿** | 无时间码、无低置信；可选同上润色（段间空行 + 修订轨；导出时直接润色） |
| 4 | 可选 | **修订摘要附录**（来自 `edit_log`，与润色修订轨独立；导出润色成功写 `export_llm_polish` 审计行） |
| 5 | 导出真源 | SQLite `segments` 当前定稿 + 项目元数据 |

### 不做（v1）

- OpenXML Track Changes **往返编辑**（仅导出只读呈现润色 diff；不含 Word 内继续改稿回写）
- 协作批注真源（C6）
- CAT 双语排版

## 验收标准

- [x] Rust + TS **共享 fixture** `exportTrackMarkupCases.json`：修订轨可见性（`export_track_markup_shared_fixture` / Vitest `lineWouldHaveWordTrackMarkup`）
- [x] Rust DOCX 结构断言：`polish_track_changes_emits_ins_and_del`、`polish_track_inline_diff_on_typo_fix`（`word/document.xml` 含 `w:ins`/`w:del`）
- [x] 讲稿润色：导出时直接请求 LLM（`fetchExportPolishResult` → `planDeliveryDocxExport`）；门禁仅 LLM/正文前置（`assessExportPolishReadiness`）
- [x] `assertExportPolishParagraphsAlignLines`：自然段扁平正文与 `correctedLines` 一致
- [x] `project_record_edit_log`：`export_llm_polish` 审计（无快照）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [x] 三种形态各导出 1 份，Word 打开无乱码、段落与编辑器一致（抽检 3 段）
- [x] 低置信标记策略与 P3 一致或文档化差异
- [x] 重启应用后再次导出，与 DB 一致

## 手测场景（已签收 2026-06-03；润色流程 2026-07-13 更新）

1. [x] 仅 ASR + 手改 → 干净稿  
2. [x] R3t-E 写回后 → 逐字稿 + 可选修订附录  
3. [ ] 讲稿 + 大模型润色：勾选后直接 **导出 DOCX**（导出中请求 LLM；Word 修订仅错字/标点；自然段约 ≤300 字；截断/解析失败自动拆批或冷重试）
4. [ ] 勾选润色但 LLM 未就绪 → 导出按钮禁用并提示配置原因  
5. [x] ~~预览闸门~~（已移除：无需预览即可导出）

## 润色导出（2026-07-13）

| 能力 | 落位 |
|------|------|
| 导出时直接润色 | `useExportController.exportDeliveryDocx` → `fetchExportPolishResult` |
| 导出门禁 | `assessExportPolishReadiness`（仅 LLM/正文）、`DeliveryExportDialog` |
| 段落合并 | `coalesceExportParagraphBreaks`（单段约 ≤300 字） |
| 修订轨 diff | `export_docx_polish_track_diff.rs` + TS `exportPolishTrackMarkup.ts` |
| DOCX 写入 | `export_docx_polish_track_write.rs` |
| LLM 润色命令 | `postprocess_export_polish_cmd.rs` |
| 定稿钳制 | `clampExportPolishLinesToEligible`（超范围回退原文） |

## 依赖

- **R3t-B** 语段落库稳定  
- **建议** R3t-E 签收后编码（词表校对写回与导出脚注一致）  
- **不依赖** R6–R8

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `export_docx.rs`、`export_docx_polish_track_{diff,write}.rs`、`postprocess_export_polish_cmd.rs` |
| TS | `DeliveryExportDialog.tsx`、`exportDocxPolish.ts`、`exportPolishDelivery.ts`、`useExportController.ts` |
