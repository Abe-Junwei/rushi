# 调研：语段正文输入路径 P0（草稿广播 · 镜像 defer）

> **状态**：规划门禁（2026-06-11）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（编辑工作台 · 纵向薄片）  
> **关联 spec**：[`segment-text-input-p0-intent.md`](./segment-text-input-p0-intent.md) · [`segment-text-input-p0-plan.md`](./segment-text-input-p0-plan.md) · [`segment-text-input-p0-acceptance.md`](./segment-text-input-p0-acceptance.md)  
> **前置诊断**：Agent 会话 2026-06-11（`useSegmentDraftStore` 每键 emit + `CorrectableMatchText` 镜像）  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 改稿工作台长时间在语段正文 **连续输入中文**；期望光标跟手、无可见延迟；换段时滚动可接受但 **正文区不应跳闪** |
| **本仓现状** | **编辑模型**：选中行 `textarea`（uncontrolled + `defaultValue`），未选中静态 `<div>` 单行 ellipsis（`apps/desktop/src/components/segmentRow/SegmentRowTextField.tsx`）。**草稿**：`apps/desktop/src/hooks/useSegmentDraftStore.ts` 每 `setDraft` → `emit()` → 全局订阅者重算。**装饰**：有纠错规则时 `text-transparent` + `apps/desktop/src/components/segmentRow/CorrectableMatchText.tsx` 镜像，随 `liveText` 每键重建。**页脚**：[`useTranscriptFooterStats`](../../../apps/desktop/src/hooks/useTranscriptFooterStats.ts) 每 emit 对 **全表** `segmentsWithDraftsApplied` + 计字数。**列表**：[`EditorSegmentWorkbench`](../../../apps/desktop/src/components/editor/EditorSegmentWorkbench.tsx) memo 挡住大部分重渲染；瓶颈在 **选中行 + 页脚** |
| **成功标准** | （1）有纠错规则时长段连续输入 **主观跟手**（手测清单）；（2）页脚字数仍随输入更新，但 **≤10Hz**；（3）自动保存 / 脏检查 / blur 落库行为 **不变**；（4）硬闸门全绿 |

### 1.1 与相邻议题边界

| 议题 | 关系 |
|------|------|
| P1 常驻 textarea / 轻滚动 | ✅ 2026-06-11 编码+手测；见 P0 plan §5 |
| 虚拟列表阈值 200 | ✅ P1 已改；≥200 段启用虚拟化 |
| 语段标注 / 四态徽标 | 正交；不增行内 DOM |
| R3s 引擎 / ASR | 无关 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **装饰与输入分离** | CodeMirror 6 / ProseMirror / Monaco | 文档模型 + **viewport 装饰**；输入不触发全文档 React 树重建 | CM6 view plugins |
| **B** | **延迟/合并副作用** | React 18 `useDeferredValue` / `startTransition` | 高优先级：DOM 输入；低优先级：高亮、统计 | [React docs — deferring UI updates](https://react.dev/reference/react/useDeferredValue) |
| **C** | **段网格本地缓冲** | memoQ / Trint | 格内编辑缓冲；**保存/失焦** 才触发项目级重算 | Trint editor |
| **D** | **文稿单层编辑** | Descript Script | 单 surface；词级高亮不遮挡 textarea 文字 | Descript Correct UI |

### 2.1 路线对照

| 维度 | Rushi 现状 | A/B（推荐） | C | D |
|------|------------|-------------|---|---|
| 输入热路径 | emit → 镜像 + 全表字数 | 输入 **silent**；装饰 defer | 格内 local | 单 editor |
| 错词高亮 | 双层层叠 + 透明字 | overlay **idle/deferred** | 侧栏/列 | inline mark |
| 改造成本 | — | **低–中**（无换编辑器） | 中 | 高 |

**结论**：P0 采用 **B + A 原则**（defer + 合并 emit），**不**引入 ProseMirror；P1 再考虑 DOM 模型（常驻 textarea）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 风险 |
|------|--------|----------|------|------|
| **B defer 镜像** | **高** | `useDeferredValue(liveText)` 仅喂 mirror | 查找替换预览需仍跟手 → panel open 时 **不 defer** | 极短输入时高亮略滞后（可接受） |
| **合并 emit** | **高** | `requestAnimationFrame` 合并 / `silent` flag | 自动保存须在 composition 结束后再 schedule | 须测 IME |
| **节流页脚** | **高** | 同一 rAF 或 100ms throttle | 字数仍须 **最终一致** | 低 |
| **D 单层** | 低 | — | 大改 | Defer P1 |

**本仓须复用（禁止 fork）**

| 模块 | 路径 |
|------|------|
| 草稿真源 | `useSegmentDraftStore.ts` |
| 行编辑 | `useSegmentRowTextFieldEditing.ts` · `SegmentRowTextField.tsx` |
| 脏读 | `segmentDirtyRead.ts` · `flushSegmentTextDrafts.ts` |
| 自动保存 | `useAutoSaveSegments.ts` |
| 页脚统计 | `useTranscriptFooterStats.ts` |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **P0 范围** | ① 草稿 **合并 notify**；② 镜像/页脚 **defer 或 throttle**；③ **聚焦输入时** textarea 不透明（错词高亮延迟到 deferred 层） |
| **不做什么** | 换 contenteditable；改虚拟化阈值；改 blur 落库语义；P1 滚动/常驻 textarea |
| **ADR** | 与 [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) L5 草稿真源一致 |
| **Spike** | 不需要；手测 + 现有单测扩展即可 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Store | `useSegmentDraftStore.ts` | `setDraft(..., { notify?: boolean })` 或 rAF 合并 `emit` |
| Hook | `useSegmentRowTextFieldController.ts` | `deferredLiveText` 供 mirror；聚焦态禁用 `text-transparent` |
| Hook | `useTranscriptFooterStats.ts` | throttle / 订阅合并后快照 |
| Hook | `useAutoSaveSegments.ts` | `pending` status 幂等，避免每键 setState |
| 测试 | `segmentDraftStore.test.ts` · 新增 throttle 单测 | 行为回归 |
| 文档 | 本 spec 三件套 + hand-test | — |

---

## 6. 签收

- [ ] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版（诊断会话落盘） |
