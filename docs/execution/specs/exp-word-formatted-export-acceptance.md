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
| 2 | **讲稿** | 默认按语段自然段；可选 **大模型润色**（纠错字、标点、语义分段；**Word 修订轨**仅错字/标点；语义分段 ≤12 段不进修订；**须先生成预览再导出**） |
| 3 | **干净稿** | 无时间码、无低置信；可选同上润色（段间空行 + 修订轨） |
| 4 | 可选 | **修订摘要附录**（来自 `edit_log`，与润色修订轨独立；导出润色成功写 `export_llm_polish` 审计行） |
| 5 | 导出真源 | SQLite `segments` 当前定稿 + 项目元数据 |

### 不做（v1）

- OpenXML Track Changes **往返编辑**（仅导出只读呈现润色 diff；不含 Word 内继续改稿回写）
- 协作批注真源（C6）
- CAT 双语排版

## 验收标准

- [x] Rust + TS **共享 fixture** `exportTrackMarkupCases.json`：修订轨可见性（`export_track_markup_shared_fixture` / Vitest `lineWouldHaveWordTrackMarkup`）
- [x] Rust DOCX 结构断言：`polish_track_changes_emits_ins_and_del`、`polish_track_inline_diff_on_typo_fix`（`word/document.xml` 含 `w:ins`/`w:del`）
- [x] 讲稿润色：**预览指纹** + **导出硬闸**（`assessExportPolishReadiness` / `resolveExportPolishForDelivery` 不二次 LLM）
- [x] `assertExportPolishParagraphsAlignLines`：自然段扁平正文与 `correctedLines` 一致
- [x] `project_record_edit_log`：`export_llm_polish` 审计（无快照）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [x] 三种形态各导出 1 份，Word 打开无乱码、段落与编辑器一致（抽检 3 段）
- [x] 低置信标记策略与 P3 一致或文档化差异
- [x] 重启应用后再次导出，与 DB 一致

## 手测场景（已签收 2026-06-03）

1. [x] 仅 ASR + 手改 → 干净稿  
2. [x] R3t-E 写回后 → 逐字稿 + 可选修订附录  
3. [x] 讲稿 + 大模型润色：**生成预览** → 不改语段 → **导出 DOCX**（只请求 LLM 一次；Word 修订仅错字/标点；自然段不过碎）  
4. [x] 勾选润色但未预览 → 导出按钮禁用并提示「请先生成预览」  
5. [x] 预览后改语段正文 → 预览失效，须重新生成  

## 润色导出（2026-06-03 收尾）

| 能力 | 落位 |
|------|------|
| 预览/导出指纹缓存 | `exportPolishPreviewCache` + `segmentsFingerprint` |
| 导出门禁 | `assessExportPolishReadiness`、`DeliveryExportDialog` |
| 段落合并 | `coalesceExportParagraphBreaks`（≤12 段） |
| 修订轨 diff | `export_docx_polish_track_diff.rs` + TS `exportPolishTrackMarkup.ts` |
| DOCX 写入 | `export_docx_polish_track_write.rs` |
| LLM 润色命令 | `postprocess_export_polish_cmd.rs` |
| 预览说明 | 保留原文行 / 不进修订轨行（`buildExportPolishPreviewNotes`） |

## 依赖

- **R3t-B** 语段落库稳定  
- **建议** R3t-E 签收后编码（词表校对写回与导出脚注一致）  
- **不依赖** R6–R8

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `export_docx.rs`、`export_docx_polish_track_{diff,write}.rs`、`postprocess_export_polish_cmd.rs` |
| TS | `DeliveryExportDialog.tsx`、`exportDocxPolish.ts`、`exportPolishDelivery.ts`、`useExportController.ts` |
