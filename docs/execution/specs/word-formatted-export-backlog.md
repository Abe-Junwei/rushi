# Backlog: 终稿 Word 格式化导出（EXP-WORD）

> **状态**：✅ v1 已交付（2026-06-03 功能验收）；后续增强见下文 §4  
> **验收真源**：[`exp-word-formatted-export-acceptance.md`](./exp-word-formatted-export-acceptance.md)  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1、§8.1  
> **关联**：[`p3-acceptance.md`](../p3-acceptance.md)（**已有**基础 DOCX）、[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)、[`collaboration-review-word-export.md`](./collaboration-review-word-export.md)（协作 **C6**，远期）

---

## 1. 缺口说明

用户路径：**本机 ASR 转写 →（可选）LLM 校准 → 人工校对定稿 → 交付 Word**。

| 能力 | 现状 | 缺口 |
|------|------|------|
| **TXT / SRT** | ✅ P0/P3 | — |
| **DOCX 逐字稿 / 讲稿** | ✅ P3 最小实现（`export_docx.rs`：时间行 + 正文；低置信黄底；讲稿连写） | **未**按 R3t 管线收口；**未**规划「定稿排版」与修订可追溯导出 |
| **协作 Word 审阅导出** | 📋 仅 [`collaboration-review-word-export.md`](./collaboration-review-word-export.md) **C6**（依赖多人批注真源） | **单机**终稿不应等到 C6 |
| **CAT 双语 DOCX** | 📋 [`translation-dictionary-module.md`](./translation-dictionary-module.md) T6 | **远期**；与 **中文定稿** 不同 Epic |

**结论**：不是「完全没有 Word」，而是 **「转写 + LLM + 人工校对完成后的格式化交付」** 未进入 **R3t 路线图与排期**；本文补登记。

---

## 2. 与协作 C6 的边界

| 维度 | **EXP-WORD**（本 backlog） | **C6 Word 审阅导出**（协作远期） |
|------|---------------------------|-------------------------------|
| 用户 | **单机**本地项目 | 协作项目、多人 |
| 真源 | SQLite `segments` + 可选 `edit_log` | 服务端批注 / suggestion / revision_events |
| v1 形态 | 固定版式 DOCX（逐字稿 / 讲稿 / 干净稿）+ 可选**修订摘要附录** | 干净稿 / 批注稿 / 建议修改附录；可能退化无 Track Changes |
| 依赖 | **R3t-E 签收后**（建议） | R8 + C4 批注落库 |
| 不做 v1 | OpenXML 完整 Track Changes 往返编辑 | — |

---

## 3. 管线位置（L6）

```text
L0–L3  ASR 转写 + 落库
L4     R3t-C/D/E  LLM（用户确认写回）
L5     人工编辑定稿（草稿 store、低置信处理）     ← 已有
L6     EXP-WORD  格式化 Word 导出（本 Epic）      ← 规划
```

架构图见 [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) §3（L6 已补）。

---

## 4. 候选子阶段（草案）

| ID | 内容 | 依赖 |
|----|------|------|
| **EXP-WORD-1** | **导出真源对齐**：导出前 `flushSegmentTextDrafts`；正文与 UI 一致；可选写入 `source` / 导出时间元数据 | R3t-B 稳定段 |
| **EXP-WORD-2** | **逐字稿增强**：时间码版式、段间空行、低置信样式；可选「仅导出选中文件/范围」 | P3 基线 |
| **EXP-WORD-3** | **讲稿 / 干净稿**：无时间轴连续正文；段落规则（按语段或按空行合并）；固定模板（标题、课程名占位） | WORD-2 |
| **EXP-WORD-4** | **修订可追溯（单机）**：**导出时可选**附录页——LLM/`edit_log` 摘要、术语表摘录；**非** Word 内批注气泡 | R3t-E；可选 edit_log |
| **EXP-WORD-5** | **导出预设 UI**：「交付导出」向导（逐字稿 / 讲稿 / 干净稿 + **是否含附录**） | WORD-3/4 |

**v1 明确不做**：

- Word **Tracked Changes** 双向编辑
- 依赖协作服务端批注（留给 C6）
- 翻译对照栏（留给 CAT-TRAN）
- 静默覆盖项目正文

---

## 5. 规划落位（实施时）

| 层 | 文件（已有 / 新建） |
|----|---------------------|
| Rust | `export_docx.rs` 扩展；可选 `export_format.rs` 纯函数（段落合并规则） |
| TS | `useExportController.ts`、`exportFormatters.ts`、`EditorToolbar.tsx` |
| Spec | 立项时补 `word-formatted-export-{intent,plan,acceptance}.md` 三件套 |

---

## 6. 排期（已拍板，路线图 §8.2）

| ID | 决定 |
|----|------|
| **Q-WORD-1** | **R3t-E 之后、R4 之前** |
| **Q-WORD-2** | 修订摘要附录：**导出向导可选**；不做 Word Track Changes |
| **Q-WORD-3** | v1：逐字稿增强 + 讲稿/干净稿；不等 C6 |

```text
… → R3t-C → R3t-D → R3t-E
    → EXP-WORD-1～3（最小可交付：增强逐字稿 + 讲稿/干净稿）
    → EXP-WORD-4/5（修订附录可选 + 导出向导）
    → R4 …
```

**R9 手测**应包含：**转写 →（可选）LLM 校对 → 人工改一句 → 导出 Word → 用 Word 打开版式正确**。

---

## 7. 文档索引

| 文档 | 关系 |
|------|------|
| [`p3-acceptance.md`](../p3-acceptance.md) | 当前 DOCX 签收范围（基线） |
| [`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md) | R3t 上游 |
| [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8.1 | 排期索引 |

---

## 8. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-27 | 初版：补单机终稿 Word 格式化缺口；与 C6/CAT 分轨 |
