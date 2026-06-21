# 调研：Selection Chrome Bus（列表 + 波形选中视觉与 React 解耦）

> **状态**：已采纳（2026-06-21）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) — 编辑器交互 perf 横切  
> **关联 spec**：[`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md) · [`selection-chrome-bus-acceptance.md`](./selection-chrome-bus-acceptance.md)  
> **前置证据**：193 段素材 `__rushiSelectionProfile` — `firstPaint≈20ms`（波形 imperative OK）· `listCommit≈400ms`（列表 React commit）  
> **关联架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) · [`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md)  
> **门禁**：编码前须链接本文（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 长转写（90–500+ 语段）编辑：波形点选语段、列表跟选、键盘 ↑↓；期望 **点击后 <50ms 可见高亮**，不「卡住半秒」。 |
| **本仓现状** | **不对称架构**：波形 B15 已 Display/Interaction 分离（Canvas band + imperative overlay chrome，`applyWaveformSegmentSelectionImperative.ts`）；列表仍 **`selectedIdx` 顶层 React state → Editor 树 reconcile**。入口唯一内核 [`useTranscriptionLayerSelection.selectSegmentAt`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts)。虚拟列表 [`useEditorSegmentListScroll`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts) 在选中时可能 `bumpScrollEpoch` + `maybePinSegmentListVirtualWindow`。近期补丁：去 `flushSync`、波形 imperative、`startTransition`、跳过多余 listScrollCorrect — **波形 ~20ms，列表 ~400ms 仍在**。 |
| **成功标准** | 193 段文件：波形 + 列表 **imperative chrome <30ms**（profile）；React `listCommit` 可 >100ms 但 **不阻塞主线程感知**；多选/filter/Tab **无 chrome 与逻辑 desync**（手测矩阵 SC-H1–H12）。 |

---

## 2. 业内成熟路线（≥5）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **Imperative decoration** | VS Code / Monaco | 选区/光标用 decoration API 改 DOM/CSS，**不重 parse 全文** | [Monaco decorations](https://microsoft.github.io/monaco-editor/docs.html#interfaces/editor.ICodeEditor.html#addDecorations) |
| B | **Timeline engine selection bus** | Premiere / DaVinci / Reaper | 选中态在引擎/文档模型；UI 面板 **订阅 selection changed**；时间轴 clip 只重绘变化区域 | 产品观察 |
| C | **Display / Interaction 分离** | Rushi B15（已实施） | Canvas 全量 display；DOM **仅** interactive 子集（选中 + draft） | [`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md) |
| D | **External store + row subscription** | TanStack Virtual、react-virtuoso | 虚拟列表行通过 `useSyncExternalStore` 或 context selector **按 index 订阅**，父列表不因 primary selection 整树 reconcile | [TanStack Virtual](https://tanstack.com/virtual/latest) · [Virtuoso](https://virtuoso.dev/) |
| E | **Transcript + timeline dual view** | Descript / Otter | 脚本与时间轴共享文档模型；列表虚拟化 + **视图层不随每次点击整树更新** | [Descript — Edit like a doc](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc) |
| F | **Transition deprioritize only** | React 18 `startTransition` | 降低 state 更新优先级；**不消除** reconcile 成本 | [React useTransition](https://react.dev/reference/react/useTransition) — **已在本仓验证不足** |

### 2.1 对照结论

- **F（仅 startTransition）**：profile 证明 chrome 可 20ms，但 `listCommit` 仍 ~400ms；用户若盯列表行仍觉 lag。  
- **A + C + D** 组合与 Rushi 波形已有方向一致，且 **不要求** 列表改 Canvas 或非 React textarea。  
- **B/E** 的「文档模型真源」本仓已有（`selectedIdx` + `useSegmentSelectionController`），缺的是 **视觉层总线**，不是第二套逻辑内核。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 |
|------|--------|----------------|-------------------|-------------|
| A Monaco decoration | **中** | prev/next O(1) DOM class 切换 | 列表有 textarea/draft，不能完全 decoration 化编辑态 | 极低增量 |
| B Engine bus | **中** | 事件顺序：chrome 同步 → logic 异步 | 须对齐 `focus=selected`（S2′）、undo 锚点 | 无侧车 |
| C B15 波形 | **高** | `applyWaveformSegmentSelectionImperative`、band rAF | 列表 `[data-seg-row]` 已有，需对称 API | 已验证 ~20ms |
| D Row subscription | **高** | `useSyncExternalStore` 模式 | 与 `SegmentTextListRow` memo 自定义 comparator 需收敛 | 减 reconcile |
| E Descript 双视图 | **低–中** | 产品预期：列表可略晚于波形亮 | 全文档模型重写 **非目标** | — |
| F startTransition | **高**（已有） | 保留作 logic 慢路径 | ** alone 不够** | 仍 ~400ms CPU |

**本仓已有可复用模块**（扩展，不 fork）：

| 模块 | 路径 |
|------|------|
| 波形 imperative chrome | [`applyWaveformSegmentSelectionImperative.ts`](../../../apps/desktop/src/services/waveform/applyWaveformSegmentSelectionImperative.ts) |
| 选中唯一内核 | [`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts) |
| 列表 DOM 锚点 | `[data-seg-row]` · `.seg-row-selected` · [`SegmentTextListRow.tsx`](../../../apps/desktop/src/components/SegmentTextListRow.tsx) |
| 列表 scroll / 虚拟窗 | [`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts) · [`segmentListVirtualWindowCore.ts`](../../../apps/desktop/src/utils/segmentListVirtualWindowCore.ts) |
| 多选逻辑 | [`useSegmentSelectionController.ts`](../../../apps/desktop/src/pages/useSegmentSelectionController.ts) |
| 性能 profile | [`selectionLatencyProfile.ts`](../../../apps/desktop/src/services/ui/selectionLatencyProfile.ts) |
| reveal/seek 策略 | [`selectionRevealSeekPolicy.ts`](../../../apps/desktop/src/utils/selectionRevealSeekPolicy.ts) |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **Selection Chrome Bus**：`selectionChromeStore`（external store）+ `applySelectionChromeImperative`（波形 + 列表同步 DOM）+ `selectSegmentAt` 仍写 React 逻辑态（`startTransition`）+ 列表行 `useSyncExternalStore` 订阅（Phase 3）+ 虚拟窗与选中解耦（Phase 2）。 |
| **不做什么** | 第二套选中内核；列表 Canvas 化；取消 `selectedIdx` React state；L1-C 全动态行高（见 [`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md)）；用 `flushSync` 换 perf；解决 tier scroll compositor（独立薄片）。 |
| **与 ADR / architecture** | 扩展 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §点选契约：增加 **SC1 逻辑选中 / SC2 chrome 视觉** 二维；与 B15 Display/Interaction **对齐到列表**。不修改 [`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) grill 矩阵（reveal/seek 顺序不变）。 |
| **风险与 spike** | **双写 desync**（chrome vs React）：Phase 1 末手测 + Phase 4 reconciliation effect。**Filter 隐藏选中**：chrome 不画不可见行，banner 仍靠 React。**多选**：chrome 须处理 `inSelection` 集合，非仅 primary。Spike 不需要 — 波形 imperative 已验证。 |

### 4.1 能否「彻底」？

| 目标 | 预期 |
|------|------|
| 点击视觉反馈 <50ms | **是**（imperative chrome） |
| 主线程不被选中 commit 卡住 | **基本是**（transition + 行级订阅） |
| 选中零 React 工作 | **否** — overlay handles、band repaint、toolbar、多选 Set 仍要更新 |
| 滚动 perf | **否** — 本薄片范围外 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| **Store** | `apps/desktop/src/services/selection/selectionChromeStore.ts` | 新增 |
| **Imperative** | `apps/desktop/src/services/selection/applySelectionChromeImperative.ts` | 新增（吸收 waveform 专用函数） |
| **Hook** | `apps/desktop/src/hooks/useSegmentRowSelection.ts` | 新增 |
| **Selection 内核** | `useTranscriptionLayerSelection.ts` | 改：写 store + 统一 imperative |
| **列表** | `useEditorSegmentListScroll.ts` · `EditorSegmentList.tsx` · `SegmentTextListRow.tsx` | 改：解耦 / 订阅 |
| **Profile** | `selectionLatencyProfile.ts` | 改：`listChrome` span |
| **架构** | `desktop-waveform-engine.md` | 改：§点选 + SC1/SC2 |
| **守卫** | `scripts/check-architecture-guard.mjs` | 可选：禁止列表外 direct `seg-row-selected` toggle |
| **测试** | `selectionChromeStore.test.ts` · `applySelectionChromeImperative.test.ts` · 扩展 profile tests | 新增 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] plan / acceptance 已链接本文
- [x] 用户确认可进入编码（2026-06-21）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：profile 证据 + 五路线 + Selection Chrome Bus 决策 |
