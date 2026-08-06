# 调研：导出 LLM 保真整理与讲稿优化分轨

> **状态**：已完成，待 Plan 确认（2026-08-06）  
> **关联 architecture**：[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) · [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)  
> **关联 spec**：[`export-llm-fidelity-and-lecture-optimize-intent.md`](./export-llm-fidelity-and-lecture-optimize-intent.md) · [`export-llm-fidelity-and-lecture-optimize-plan.md`](./export-llm-fidelity-and-lecture-optimize-plan.md) · [`export-llm-fidelity-and-lecture-optimize-acceptance.md`](./export-llm-fidelity-and-lecture-optimize-acceptance.md)  
> **门禁**：本文完成前不进入业务编码。

---

## 1. 问题陈述

| 项 | 内容 |
|---|---|
| 用户场景 | 导出开示、访谈或会议讲稿；一类用户要求逐字完整，另一类愿意审核 LLM 的去赘词、理语序与口语书面化建议 |
| 本仓现状 | `export_polish` 已收紧为“可信错字规则 + LLM 标点/分段”，去标点正文必须逐字一致；导出无预览、直接生成 DOCX |
| 问题 | “大模型润色”文案与实际保真行为不符；若直接放宽现有门禁，会重新引入静默删改风险 |
| 成功标准 | 保真整理不变；讲稿优化只产生待审核建议，用户确认后仅影响本次 Word 导出，不写回 SQLite；Word 可接受/拒绝全部修订 |

## 2. 业内成熟路线

| # | 路线 | 代表实现 | 核心机制 | 证据 |
|---|---|---|---|---|
| A | 文档内延迟接受 | Microsoft Word Track Changes | 原文与插入/删除并存，可逐项或全部接受/拒绝；隐藏 markup 不等于删除修订 | [Microsoft Support](https://support.microsoft.com/en-US/Word/accept-or-reject-tracked-changes-in-word) |
| B | 建议模式 + 接受预览 | Google Docs Suggesting | 建议不直接覆盖原文，可逐条/全部接受拒绝，并可预览“全接受/全拒绝”两种结果 | [Google Docs Help](https://support.google.com/docs/answer/6033474?co=GENIE.Platform%3DDesktop&hl=en-EN) · [SuggestionsViewMode](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#suggestionsviewmode) |
| C | 直接生成终稿 | 常见 LLM 改写工具 | Prompt 返回改写全文，直接覆盖或导出 | 实现最简单，但无法满足本仓“不静默改稿”信任边界，不采用 |

## 3. 可复用评估

| 路线 | 复用度 | 可直接复用 | 与 Rushi 的冲突 | 结论 |
|---|---|---|---|---|
| Word Track Changes | 高 | Rust 已有逐行 diff、修订作者、DOCX 完整性不变量 | 现有 diff 会过滤大段改写，讲稿优化需要独立 unrestricted 修订策略 | 采用为交付层 |
| Google Suggesting | 高 | 现有 `PostTranscribeStageBPreviewPanel`、`segmentChangePreview`、逐语段勾选与 diff 高亮 | 需新建导出专用状态机，不能复用“确认写回”语义 | 采用为应用内审核层 |
| 直接终稿 | 低 | 现有 `fetchExportPolishResult` 直导出编排 | 改写不可自动变成终稿 | 拒绝 |

**本仓已有可复用模块**：

- `apps/desktop/src/components/postTranscribeStageB/PostTranscribeStageBPreviewPanel.tsx`
- `apps/desktop/src/services/editor/segmentChangePreview.ts`
- `apps/desktop/src-tauri/src/export_docx_polish_track_write.rs`
- `apps/desktop/src/services/exportPolishParagraphs.ts`
- `apps/desktop/src-tauri/src/postprocess_export_polish_cmd.rs` 的分批、取消与进度模式

## 4. 决策摘要

| 问题 | 结论 |
|---|---|
| 选定方案 | **应用内建议预览 + Word 完整修订轨**：预览选中的建议才进入导出，Word 内仍可二次接受/拒绝 |
| 能力分轨 | 现有 `export_polish` 语义固化为“LLM 保真整理”；新增独立 `export_lecture_optimize` 契约，不放宽保真门禁 |
| 讲稿优化 v1 权限 | 可去口头赘词/重复、修正明显语病、调整口语语序、统一标点；不得新增事实、摘要、调换语段顺序或删除整个非空语段 |
| 真源策略 | SQLite 语段不写回；优化结果只存于本次预览和 DOCX；取消/失败时零改动 |
| 协议 | 稳定 `id` + 每语段一个非空 `text`；缺失/重复/越界/错类型按批回退；不允许 merge/reorder |
| 交付 | 一级选项收敛为“逐字稿 / LLM 保真整理 / 讲稿优化”；移除与逐字稿内容重复的普通讲稿 |
| 不做什么 | 不将优化结果写回编辑器；不允许整行删除、语段合并/重排；不与保真整理共用同一个内容门禁函数 |

## 5. 落位预告

| 层 | 文件 / 模块 | 变更 |
|---|---|---|
| Rust LLM | `postprocess_export_lecture_optimize*.rs` | 独立 Prompt、解析、批级回退与命令；复用 HTTP/runtime 边界 |
| TS service | `exportLectureOptimize*.ts` | 结果对齐、建议列表、用户勾选后的导出行 |
| UI | `DeliveryExportDialog.tsx` + 新预览 dialog/controller | 三种互斥交付模式 + 讲稿优化加载/预览/确认导出 |
| DOCX | `export_docx_polish_track_*.rs` | 新增 `fidelity` / `lecture_optimize` 修订策略，保持双视图不变量 |
| 测试 | Rust + Vitest + 真实长文稿手测 | 契约、选择性建议、DOCX 全接受/全拒绝、不写库 |

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 链接本文
- [ ] 用户确认 Plan 后进入编码

**变更记录**

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初版：保真整理与讲稿优化分轨，采用双层建议审核 |
