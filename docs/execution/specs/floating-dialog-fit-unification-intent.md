# Spec(intent): FLOAT-FIT — 浮动对话框壳层贴合统一

> **词汇**：[`CONTEXT.md`](../../../CONTEXT.md) §浮动对话框（Auto-fit / Fill / Static-fit）  
> **Architecture**：[`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)（本 spec 落地后同步修订）  
> **Plan**：[`floating-dialog-fit-unification-plan.md`](./floating-dialog-fit-unification-plan.md)  
> **Acceptance**：[`floating-dialog-fit-unification-acceptance.md`](./floating-dialog-fit-unification-acceptance.md)  
> ⚠️ **最终实现路线（已落地，取代下文 boolean 映射方案）**：CSS 自动高度单一真源 — `.cursor/plans/float-fit-css-auto-height`。`fitKind` 仅映射高度模式（autoFit/staticFit → `auto`，fill → `manual`），不再有 `fillHeight`/`fillAvailable`/估算/实测/merge 分叉；高度真源 = 浏览器布局（`height:auto`+`max-height`）。下文 §1–§N 的 boolean 映射细节为历史方案，以本 banner 与架构文档为准。

---

## §0 调研与决策（合并 research）

### 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Editor / Hub 打开浮动工具框（查找替换、规则纠错 preview、智能改稿 preview、交付导出等）；少行语段时框不应内嵌大块空白；多行时列表 cap 内滚、底栏不被裁切；匹配数/阶段变化时整框高度应跟随（Auto-fit） |
| 本仓现状 | 壳层 `DraggableResizablePanel` 固定 `height` + 正文 flex 两套尺寸系统；`contentFitHeight` / `ResizeObserver` / section 估算分散在 `CompactFloatingDialog` 与 3 处 `FloatingPanelTemplate` bypass（`findReplace` preset）；`fillAvailable`+`fillHeight` 与 intrinsic 列表混用导致多轮布局 bug |
| 成功标准 | 按 `PanelFitKind` 分表后，各代表对话框手测通过；architecture-guard 禁止新业务 bypass；单测覆盖 `layoutRev` 与 fit height 单调性 |

### 业内对照（≥2）

| # | 路线 | 代表 | 机制 | 与 Rushi |
|---|------|------|------|----------|
| A | 壳层封顶 + 单滚动区 | Radix Dialog、Material Dialog | `max-h-[85vh]` + `overflow-y-auto` | 简单；少行时不随内容变矮，不符合 Editor 工具框预期 |
| B | Intrinsic + cap + 手动 fill | JetBrains 弹窗、Slack compose | 打开 estimate/measure；用户拖大后列表吃剩余 | **最接近**；对应 Auto-fit + 用户拖大后 fill 列表 |
| C | Inline 控件 | VS Code Find | 查找条非浮动框 | 产品取舍；**v1 不做** |

### 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A | 低 | maxHeight clamp | 与「少行紧凑」目标冲突 |
| B | 高 | section 估算 + measure merge | 须显式 Layout Mode，禁止 boolean 组合试错 |

**本仓已有模块（扩展，不 fork）：**

- `CompactFloatingDialog`、`floatingPanelFitSections`、`FloatingPanelDialogLayout`、`FloatingPanelSegmentList`
- `useFloatingPanelBodyMeasure`、`useFrozenPanelBodyHeight`、`useDraggablePanelViewportSync`
- `floatingPanelPersist`（`layoutRev` / `phases` / `userSized`）

### 决策摘要

| 问题 | 结论 |
|------|------|
| 范围 | **B**：所有带 `contentFitHeight` 的 compact / findReplace 类 Floating dialog |
| 默认行为 | **按类型分表（C）**，非全局单一 mode |
| Auto-fit R2 | **`layoutRev` 语义变化 → 清 `userSized`、重算壳高**（含用户曾手动拖高） |
| 术语 | **T1** → CONTEXT Auto-fit / Fill / Static-fit dialog |
| 交付 | **P2**：无独立 `*-research.md`；决策在本 intent §0 |
| ADR | v1 不写；persist 与 R2 冲突再补 |

---

## 目标

统一 Floating dialog 的 **壳层贴合契约**（`PanelFitKind` + 成品壳 API + guard），消除 `findReplace` preset bypass 与 `fillAvailable` 误用，使各对话框按分表行为一致、可测、可文档化。

## PanelFitKind 分表

| Kind | CONTEXT | 壳层 | 列表/正文 | 代表对话框 |
|------|---------|------|-----------|------------|
| `autoFit` | Auto-fit dialog | 随 section 估算+实测增减；`minHeight` 跟 `contentFitHeight` | `FloatingPanelSegmentList` **intrinsic**（`fillAvailable=false`）；cap 256px 内滚 | 查找替换、全部替换预览、规则纠错 preview、智能改稿 preview |
| `fill` | Fill dialog | 默认偏高 / 可拖；`fillHeight` + 估算下限 | `ListRegion` **fill-remaining** 或 `FloatingPanelDialogScroll` | 交付导出 Word、批量转写队列、自动转写启动、术语表学习提示、Lexicon 导入/导出 |
| `staticFit` | Static-fit dialog | 短内容贴合 | 无列表或极短 | CompactConfirm、创建项目、项目元数据、ClearAsrCache 等 |

**Restore auto height**：标题栏双击；清 `userSized` 并按当前 `contentFitHeight` 重算（所有 kind 共用）。

## 切片

| 切片 | 范围 |
|------|------|
| **F-0** | 类型 + API 壳层（`PanelFitKind`、`CompactFloatingDialog` 扩展或 `FloatingContentDialog`）；architecture 文档决策表；guard 扩围 |
| **F-1** | 迁移 **Auto-fit** bypass：`FindReplaceDialog`、`CorrectionRulesPreviewDialog`（preview 段） |
| **F-2** | 迁移 **Fill** bypass / 不一致：`DeliveryExportDialog`、`GlossaryLearnPromptDialog` |
| **F-3** | 其余 `CompactFloatingDialog` 声明 `fitKind`；`ListRegion` 默认改为 intrinsic；L3 手测条目 |

## v1 验收（摘要）

- Auto-fit：2 处匹配时壳层紧凑、无列表内大块空白；匹配 0→8→2 时壳高跟随；`layoutRev` 变后手动拖高不保留
- Fill：交付导出 / 术语表提示壳层稳定、区内滚、底栏完整
- 机器：`typecheck` + `test` + `check-architecture-guard` 无新增 error

## 明确不做（v1）

1. 不改 **environment** 设置壳（`ProjectPanel` preset=environment）
2. 不改查找替换为 **VS Code inline** 查找条
3. 不 **bump** 全局 `FLOATING_PANEL_LAYOUT_REV` / 不批量清 localStorage
4. 不统一 **EditorSegmentList** 虚拟列表与浮动预览列表（浮动预览仍 ≤256px 非虚拟化）
5. 不新增 **Storybook / 视觉回归**（unit + L3 手测即可）

## 不做（产品/架构边界）

- 第二套 panel 壳或第二套 persist 键
- 在 Auto-fit 场景默认 `flex-1` + `fillAvailable`
- 只改 CSS 不改 `contentFitHeight` / 动态 `minHeight` 的「高度修复」

---

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-19 | 初版；grill-with-docs 结论入库 |
