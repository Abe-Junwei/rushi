# 调研：导出 LLM 保真整理与讲稿优化分轨

> **状态**：已完成；2026-08-07 增补稀疏修改终态契约
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
| 成功标准 | 保真整理不变；讲稿优化直接导出 Word 修订稿，不写回 SQLite；用户可逐条接受或拒绝，每条拒绝均恢复对应原文，拒绝全部可完整恢复导出前全文 |

## 2. 业内成熟路线

| # | 路线 | 代表实现 | 核心机制 | 证据 |
|---|---|---|---|---|
| A | 文档内延迟接受 | Microsoft Word Track Changes | 原文与插入/删除并存，可逐项或全部接受/拒绝；隐藏 markup 不等于删除修订 | [Microsoft Support](https://support.microsoft.com/en-US/Word/accept-or-reject-tracked-changes-in-word) |
| B | 建议模式 + 接受预览 | Google Docs Suggesting | 建议不直接覆盖原文，可逐条/全部接受拒绝，并可预览“全接受/全拒绝”两种结果 | [Google Docs Help](https://support.google.com/docs/answer/6033474?co=GENIE.Platform%3DDesktop&hl=en-EN) · [SuggestionsViewMode](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#suggestionsviewmode) |
| C | 直接生成终稿 | 常见 LLM 改写工具 | Prompt 返回改写全文，直接覆盖或导出 | 实现最简单，但无法满足本仓“不静默改稿”信任边界，不采用 |
| D | 稀疏补丁 | JSON Patch / 建议式编辑协议 | 原文由客户端持有，只传回显式修改；未出现的目标保持不变，非法操作可逐条丢弃 | 采用为 LLM 输出权限模型 |

## 3. 可复用评估

| 路线 | 复用度 | 可直接复用 | 与 Rushi 的冲突 | 结论 |
|---|---|---|---|---|
| Word Track Changes | 高 | Rust 已有逐行 diff、修订作者、DOCX 完整性不变量 | 现有 diff 会过滤大段改写，讲稿优化需要独立 unrestricted 修订策略 | 采用为交付层 |
| Google Suggesting | 中 | 验证“建议应逐条可接受/拒绝”的交互模型 | 用户明确不在 Rushi 内预览；重复实现一套审核界面会增加状态与信任成本 | 仅作为交互参照，不落地 |
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
| 选定方案 | **Word 作为唯一审核面**：Rushi 直接导出完整修订轨，用户在 Word 中逐条或批量接受/拒绝 |
| 能力分轨 | 现有 `export_polish` 语义固化为“LLM 保真整理”；新增独立 `export_lecture_optimize` 契约，不放宽保真门禁 |
| 讲稿优化 v1 权限 | 可去口头赘词/重复、修正明显语病、调整口语语序、统一标点；不得新增事实、摘要、调换语段顺序或删除整个非空语段 |
| 真源策略 | SQLite 语段不写回；原文与优化结果只在本次 DOCX 修订轨中并存；取消/失败时零改动 |
| 协议 | 讲稿优化终态为稳定 `uid` + 稀疏 `edits`；未返回 = 不修改，坏 edit 只丢弃该条；`break_after_uid` 与正文修改解耦。完整 `items` 仅保留为迁移兼容层 |
| 交付 | 一级选项收敛为“逐字稿 / LLM 保真整理 / 讲稿优化”；移除与逐字稿内容重复的普通讲稿 |
| 可逆性 | 接受修订视图必须等于优化结果；拒绝修订视图必须逐字等于导出前原文；任一不变量失败则只交付原文 |
| 不做什么 | 不做 Rushi 内逐语段预览或勾选；不将优化结果写回编辑器；不允许整行删除、语段合并/重排；不与保真整理共用同一个内容门禁函数 |

### 4.1 稀疏协议边界

- 输入仍按 token/语段数分批，但每项使用导出快照内全局唯一且稳定的 `uid`。
- 输出 `edits` 只包含模型明确建议修改的语段；缺席合法且等于原文不变。
- 空 `edits` 与空 `break_after_uid` 合法。
- 未知、重复、空文本或字段错误的 edit 不获得修改权限；仅该 edit 被丢弃或定点重试。
- edit 若新增前后两条邻段的长句或高相似内容，视为上下文回声；首次解析与定点重试合并前均逐条拦截。
- 保真整理未来可复用 `edits` 外壳，但每条仍须经过“去标点正文逐字一致”门禁；讲稿优化使用非空、同 uid、不合并/换序的独立门禁。
- 安全与质量分离：遗漏只代表少优化，不代表正文不完整；诊断记录 omission/invalid edit，但不把 omission 当失败重试。
- DOCX 落盘硬闸门保持双视图：拒绝全部修订哈希 = 原文，接受全部修订哈希 = 客户端合并后的优化稿；3541 个输入 uid 必须全部有去向。

## 5. 落位预告

| 层 | 文件 / 模块 | 变更 |
|---|---|---|
| Rust LLM | `postprocess_export_lecture_optimize*.rs` | 独立 Prompt、解析、批级回退与命令；复用 HTTP/runtime 边界 |
| TS service | `exportLectureOptimize*.ts` | 结果对齐、批级回退与直接导出编排 |
| UI | `DeliveryExportDialog.tsx` | 三种互斥交付模式；讲稿优化直接进入生成与保存流程 |
| DOCX | `export_docx_polish_track_*.rs` | 新增 `fidelity` / `lecture_optimize` 修订策略，保持逐条修订和双视图不变量 |
| 测试 | Rust + Vitest + 真实长文稿手测 | 契约、选择性建议、DOCX 全接受/全拒绝、不写库 |

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 链接本文
- [x] 用户确认 Plan 后进入编码

**变更记录**

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初版：保真整理与讲稿优化分轨 |
| 2026-08-06 | 按产品确认改为 Word 唯一审核面，支持逐条接受/拒绝，不做应用内预览 |
| 2026-08-07 | 讲稿优化终态改为稳定 uid 的稀疏 edits；完整 items + 按 ID 回退降级为迁移兼容层 |
| 2026-08-07 | 真实 3541 段回归发现两处邻段复述；增加 context echo 单 edit 门禁与重试二次复核 |
