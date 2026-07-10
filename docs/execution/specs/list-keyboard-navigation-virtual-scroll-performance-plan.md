# Plan：列表键盘跟手感完整修复（LKB · v2）

> **Research**：[`list-keyboard-navigation-virtual-scroll-performance-research.md`](./list-keyboard-navigation-virtual-scroll-performance-research.md)  
> **Acceptance**：[`list-keyboard-navigation-virtual-scroll-performance-acceptance.md`](./list-keyboard-navigation-virtual-scroll-performance-acceptance.md)  
> **架构依赖**：[`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md) Phase 2–3  
> **Release Blocker**：[`v0.1.8.1-release-hand-test-checklist.md`](./v0.1.8.1-release-hand-test-checklist.md) §1 LKB-H4/H5/H8  
> **术语**：[`CONTEXT.md`](../../../CONTEXT.md) — SC1 · SC2 · SC4 · listKeyboard

**估时**：Phase 1–3 已落地；Phase 4–5 剩余 **~2–2.5 人日**。

---

## 0. 调查问题登记表

| ID | 问题 | 根因 | 修复 Phase | 状态 |
|----|------|------|------------|------|
| LKB-ROOT-1 | 连按偏慢；松手后列表仍跳 | 每步 **sync SC1** → 整树 commit ~300–500ms；commit backlog | **3** | ✅ 已修复：burst 内 0 SC1 commit；keyup 一次 `startTransition` |
| LKB-ROOT-2 | 松手后 tier 不 reveal；波形高亮飞出视口 | burst **禁 reveal** + keyup `finalize` 读 **滞后 React idx** 非 chrome `primaryIdx` | **2** | ✅ 已修复：keyup reveal 读 chrome primary；非 burst listKeyboard 恢复 reveal |
| LKB-ROOT-3 | CI **LKB-1 测错对象**：`syncPathTotal` **故意不含** `listCommit`/`listScroll` | perf 全绿 + 手感 FAIL 并存 | **5** | ✅ 已修复：LKB-2 闸门量 `listCommit` |
| LKB-ROOT-4 | `EditorSegmentWorkbench` / `EditorSegmentList` memo 仍比较 `selectedIdx`；`useSelectionChromePrimaryIdx` 在 list 内 → chrome 变仍整 list 重渲染 | SCB Phase 3 **未完成** | **4** | ⚠️ 部分：U13 memo 已去 selectedIdx；U11/U12 仍开放 |
| LKB-REG-1 | Step 5 误归因 microtask | 文档/实现偏离实锤 | **5 文档回滚** | ⏳ 仍开放 |
| LKB-REG-2 | working tree 堆叠补丁 | 未系统取舍 | **5** | ⏳ 仍开放 |

---

## 0.1 listKeyboard 每步更新矩阵（整树更新 inventory）

> **用途**：编码前逐项签收；禁止再堆 scroll/coalesce 补丁而不碰本表 **× burst 禁止** 行。

### 调用链（v2 实际 · 每步 listKeyboard burst）

```text
keydown → useSegmentKeyboard.coalesce → selectSegmentAt("listKeyboard", { burst: true })
  → paintSelectionChrome (SC2 imperative)          ~1ms   ✓
  → selectedIdxRef.current = idx                   ✓ U16
  → applyListKeyboardBurstListScroll               ✓ U8（imperative，不绑 SC1）
  → scheduleRevealSelectedSegment("listKeyboard")  ✓ U14（180ms debounce）
  × commitSelectedIdxUi / setSelectedIndices       ✓ U1–U2 禁止
  × EditorView / WaveformPane / Toolbar reconcile  ✓ U3–U6 禁止
  × layout effect listScroll                       ✓ U9 跳过
  × textarea focus                                 ✓ U15 defer

keyup → finalizeListKeyboardBurst → commitListKeyboardBurst(idx)
  → startTransition(setSelectedIdxUi) 一次         ✓ U1–U2
  → focus final textarea                           ✓ U15
  → finalizeListKeyboardViewport                   ✓ U14
```

### 矩阵

| # | 更新 | 触发范围 | burst 每步 | keyup / 末态 | 处置 Phase | 落位文件 | 状态 |
|---|------|----------|------------|--------------|------------|----------|------|
| U1 | **sync `setSelectedIdxUi`** | ProjectPanel → **Editor 全栈** | **× 禁止** | **✓ 一次**（`startTransition`） | **3** | `useTranscriptionLayerSelection.commitListKeyboardBurst` | ✅ |
| U2 | **`setSelectedIndices`** | 同 U1 | **×** | **✓ 一次** | **3** | `useSegmentSelectionController`（由 U1 触发） | ✅ |
| U3 | **`ProjectPanel` 新建 `txInput`** | `EditorView` 破 memo | **×** | **✓ 一次** | **3** | `ProjectPanel.tsx` | ✅ |
| U4 | **`EditorWaveformPeaksStage` / WaveformPane** | 波形子树 | **×** | **✓ 一次** | **3** | props `c.selectedIdx` | ✅ |
| U5 | **`EditorWorkbenchToolbar`** | toolbar | **×** | **✓ 一次** | **3** | `EditorWorkbenchToolbar.tsx` | ✅ |
| U6 | **`useSegmentSelectionController` effect([selectedIdx])** | selection 派生 | **×** | **✓ 一次** | **3** | `useSegmentSelectionController.ts` | ✅ |
| U7 | **`paintSelectionChrome` / store commit** | SC2 DOM + touched 行 | **✓ 必须** | reconcile | — | `publishSelectionChromeForInput` | ✅ |
| U8 | **imperative list scroll** | scrollTop + 虚拟窗 | **✓ 仅出视口** | 慢路径可补 | **3** | `applyListKeyboardBurstListScroll` · `listKeyboardBurstCoordinator` | ✅ |
| U9 | **layout effect listScroll** | 同 U8（现绑 SC1 prop） | **× 改 imperative** | **✓** | **3** | `useEditorSegmentListScroll.ts` | ✅（burst 跳过） |
| U10 | **`bumpScrollEpoch({ sync, force })` on skip** | 虚拟窗无 scroll 仍重算 | **×** | — | **3** | `useEditorSegmentListScroll.ts` | ⚠️ skip 仍 sync bump（必要回退） |
| U11 | **`virtualWindow` pin 随 SC1** | ~40 行 mount | **× 仅 scroll 变** | **✓** | **4** | `computeEditorSegmentListVirtualWindow` | ✅ useMemo 不依赖 selectedDisplayIndex |
| U12 | **`useSelectionChromePrimaryIdx` 在 list 内** | `EditorSegmentList` 父级 | **部分**→imperative scroll | — | **4** | `EditorSegmentListViewport.tsx` | ✅ SEL-1c 已移除 |
| U13 | **memo 比较 `selectedIdx`** | Workbench + List 整棵 | **×** | — | **4** | `EditorSegmentWorkbench.tsx` · `EditorSegmentList.tsx` | ✅ |
| U14 | **tier reveal debounce** | tier `scrollLeft` | **✓ debounce** | **✓ 一次**（chrome idx） | **2** | `useTranscriptionLayerSelection.ts` | ✅（debounce 配置，keyup cancel） |
| U15 | **`syncListKeyboardSegmentFocus`** | focus 重试链 | **×** | **✓ 一次** | **3** | `useSegmentKeyboard.ts` | ✅ |
| U16 | **`selectedIdxRef.current = idx`** | ref 只读路径 | **✓ 同步** | 已最新 | **3** | `useTranscriptionLayerSelection.ts` | ✅ |
| U17 | **`SegmentTextListRow` React 选中态** | 行级 | **×**（已 store 订阅） | — | — | `useSegmentRowSelection` **已有** | ✅ |
| U18 | **`selectionProfileBegin` 覆盖** | profile 噪声 | 记录 | 记录 | **2/5** | `selectionLatencyProfile.ts` | ⚠️ burst 每 step 仍 begin 一行 |
| U19 | **`skipBandPaint`（list 源）** | band canvas | **✓ 保留** | — | — | `paintSelectionChrome` | ✅ |
| U20 | **working tree 禁 listKeyboard reveal** | tier 飞出视口 | **× 回滚** | — | **2** | `useTranscriptionLayerSelection.ts` | ✅（非 burst 已恢复） |

### 必要 / 可省 / 必须 汇总

| 类别 | 更新编号 |
|------|----------|
| **burst 必须保留** | U7 · U8 · U14 · U16 · U19 |
| **burst 必须去掉** | U1–U6 · U9–U10 · U13 · U15 · U20 |
| **keyup / 末态必须** | U1–U2 各 **一次** · U14 finalize · U15 focus |
| **Phase 4 降本** | U11–U13 · U12 |
| **Phase 5 清理** | U18 · working tree 补丁 |

---

## 0.2 v2 已落地实现摘要

> 2026-06-22 代码侧最终状态。

| 文件 | 关键变更 | 验证 |
|------|----------|------|
| `useSegmentKeyboard.ts` | rAF coalesce（首帧即时 + 同帧合并）；keyup finalize；focus defer；chrome primary anchor；orphan repeat 保护 | 14 tests |
| `useEditorSegmentListScroll.ts` | layout effect 单入口写 scrollTop；burst 路径跳过 layout scroll；sync epoch bump；virtual window pin | 5 tests |
| `useTranscriptionLayerSelection.ts` | burst SC1 defer；`commitListKeyboardBurst`；imperative scroll；chrome primary reveal；非 burst reveal 恢复 | profile + chrome + LKB-2 tests |
| `applyListKeyboardBurstListScroll.ts` | 纯函数 imperative scroll，无 SC1 | 单测 |
| `listKeyboardBurstCoordinator.ts` | scroll epoch notifier / imperative scroll key / virtual pin | 单测 |
| `planEditorSegmentListSelectionScroll.ts` | 纯函数 scroll plan；listKeyboard 返回 `skipDomCorrection` / `syncEpoch` | 单测 |
| `selectionChromeStore.ts` | snapshot / `selectionChromePrimaryOutOfSync` 真源 | store tests |
| `listKeyboardNavigationBurst.perf.ts` | LKB-1 + LKB-2 CI 闸门 | V-CI perf |

---

## 1. 目标与非目标

### 目标

1. **LKB-H4**：快速连按 ↓20 次松手 → **≤200ms** 内列表/选中停止；无「多跳几段」。（✅ 代码侧）
2. **LKB-H5/H8**：tier **debounce + keyup 一次** reveal；对准 **最终语段**；textarea focus 正确。（✅ 代码侧）
3. **Profile**：193 段 burst 期间 profile 行数 ≈ **coalesce 步数**，非每物理键一行；keyup 后 **≤1 条** 含 `listCommit` 的 SC1 行。（✅ LKB-2 CI）
4. **LKB-2 CI**：burst 端到端 **`listCommit` 或 burst 末步 `total`** 过闸门。（✅）
5. Phase 1 成果 **保留**（纯函数 scroll、containment、LKB-1）。（✅）

### 非目标

| 项 | 原因 |
|----|------|
| DYN-01 动态行高 | 独立薄片 |
| CHR-02 hover/focus imperative | 独立薄片 |
| 移除 `selectedIdx` React state | undo/save/Tab 仍依赖 SC1 |
| tier scroll compositor 优化 | 独立 perf 薄片 |

---

## 2. 阶段总览

```text
Phase 1 [DONE]  虚拟 scroll 基础设施 + LKB-1
Phase 2 [DONE]  Reveal chrome primary + debounce + keyup finalize
Phase 3 [DONE]  Burst SC1 defer + LKB-2 CI
Phase 4 [PARTIAL]  SCB Phase 2–3 收束：U13 done；U11/U12 仍开放
Phase 5 [PARTIAL]  LKB-2 done；profile 噪声 U18 / guard hotspot / 补丁取舍仍开放
```

---

## Phase 1 — 虚拟 scroll 基础设施（**已完成** · `17a285e`）

- [x] `planEditorSegmentListSelectionScroll` / `computeEditorSegmentListVirtualWindow` 纯函数
- [x] `useEditorSegmentListScroll` 拆分 ≤300 行编排层（当前 316 行，接近阈值）
- [x] `EditorSegmentList` `[contain:layout_paint]`
- [x] LKB-1：`listKeyboardNavigationBurst.perf.ts`（scroll plan + syncPathTotal）
- [x] 删 `imperativeScrollListSegmentIntoView` dead path

---

## Phase 2 — Reveal + profile 真源（**LKB-2a** · **已完成**）

### Step 2.1 — 恢复 listKeyboard tier reveal（chrome 真源 · **U14 · U20**）

**文件**：[`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts)

1. ✅ **非 burst listKeyboard 路径**恢复 reveal：`if (shouldReveal && !isListKeyboardBurstStep(source, opts))`。
2. ✅ **burst 路径**保留 180ms debounce；keyup `finalizeListKeyboardViewport` 取消 pending 并 reveal 一次。
3. ✅ `finalizeListKeyboardViewport` 读 **chrome `primaryIdx`**，不读 React `selectedIdx`。

### Step 2.2 — Profile 补全

**文件**：[`selectionLatencyProfile.ts`](../../../apps/desktop/src/services/ui/selectionLatencyProfile.ts) · [`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts)

1. ✅ `useEditorSegmentListScroll` layout effect 对 listKeyboard commit 调用 `selectionProfileMarkListCommit()`。
2. ✅ `commitListKeyboardBurst` 不再主动 rAF flush，依赖 layout effect 标记 `listCommit` 后 flush。
3. ✅ 文档说明：`syncPathTotal` **不含** `listCommit` — 手测须看 **`total`**。

### Step 2.3 — 验证

- [x] 单测：`useTranscriptionLayerSelection.chrome.test.ts` keyup finalize chrome idx
- [x] 单测：LKB-2 `listCommit` 真实存在性断言

---

## Phase 3 — Burst SC1 defer（**LKB-2b 核心** · **已完成**）

### Step 3.1 — burst 内只走感知路径

**文件**：[`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts)

```text
burst 内每步（同步，须 <16ms 感知预算）:
  1. selectionChromeStore.commit + applySelectionChromeImperative   (U7)
  2. selectedIdxRef.current = idx                                  (U16)
  3. lastSegmentSelectSourceRef = listKeyboard
  4. applyListKeyboardBurstListScroll                              (U8)
  5. scheduleRevealSelectedSegment("listKeyboard") debounced       (U14)
  × commitSelectedIdxUi / setSelectedIndices                       (U1–U2)
  × focus textarea                                                 (U15)

keyup 一次:
  1. commitListKeyboardBurst → startTransition(setSelectedIdxUi)   (U1–U2)
  2. focus textarea                                                (U15)
  3. finalizeListKeyboardViewport → reveal chrome primary          (U14)
```

**硬规则**（已遵守）：

- SC2 **不得**单独写 persist/undo（沿用 SCB）。
- `selectedIdxRef` 与 chrome `primaryIdx` **同步**；keyup 前 React `selectedIdx` 可滞后。
- Shift/toggle listKeyboard：**burst 模式不适用**，仍 sync commit（低优先级路径）。

### Step 3.2 — List scroll 不依赖 SC1 commit（**U8–U10**）

**文件**：

- [`applyListKeyboardBurstListScroll.ts`](../../../apps/desktop/src/components/editor/applyListKeyboardBurstListScroll.ts) — burst 内 `planEditorSegmentListSelectionScroll` + 写 `scrollTop`
- [`listKeyboardBurstCoordinator.ts`](../../../apps/desktop/src/services/selection/listKeyboardBurstCoordinator.ts) — scroll epoch 通知 / imperative scroll key / virtual pin
- [`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts) — layout effect 对 burst 经 `shouldSkipLayoutScrollForListKeyboard` 跳过

### Step 3.3 — Keyboard 层配合（**U1–U2 · U15**）

**文件**：[`useSegmentKeyboard.ts`](../../../apps/desktop/src/hooks/useSegmentKeyboard.ts)

- [x] 保留 rAF coalesce（首键即时 + 同帧合并）。
- [x] burst 内 `advanceToSegment(..., { focus: false })`。
- [x] `finalizeListKeyboardBurst`：调用 `commitListKeyboardBurst(idx)`（keyup 一次 SC1）+ focus + viewport finalize。

### Step 3.4 — 验证

- [x] 单测：burst 10 步仅 **1 次** `setSelectedIdx`；chrome version **10 次**
- [x] Profile：LKB-2 `listCommit ≤ 120ms`（真实 `listCommit` span，非 fallback）
- [x] 手测：**LKB-H4/H8 代码侧完成**（待 release `.app` 复验）

---

## Phase 4 — SCB Phase 2–3 收束（**LKB-2c** · **部分完成**）

> 与 [`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md) Phase 2–3 **合并实施**。

### Step 4.1 — memo 去 `selectedIdx`（**U13**） ✅

**文件**：[`EditorSegmentWorkbench.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentWorkbench.tsx) · [`EditorSegmentList.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentList.tsx)

- `areEditorSegment*PropsEqual`：**移除** `selectedIdx` / `selectedIndicesArray` 比较（行级已 `useSegmentRowSelection`）。
- 保留 `segments` / `filter` / `busy` / highlight 面板状态。

### Step 4.2 — virtualWindow 与 SC1 解耦（**U11–U12**） ✅

**文件**：[`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts) · [`EditorSegmentListViewport.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentListViewport.tsx)

- ✅ `virtualWindow` pin **已显式化** via `listKeyboardBurstCoordinator`。
- ✅ `virtualWindow` useMemo **仅**依赖 `scrollEpoch` / `selectSourceEpoch`；`selectedDisplayIndex` 经 ref。
- ✅ `useSelectionChromePrimaryIdx` 已从 Viewport 移除（SEL-1c）；行级 `useSegmentRowSelection`；槽 overflow 用 CSS `:has(.seg-row-selected)`。

### Step 4.3 — keyup SC1 用 startTransition ✅

**文件**：[`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts)

- ✅ `commitListKeyboardBurst` 使用 `startTransition`。

### Step 4.4 — 验证

- [ ] React Profiler：193 段连按，`EditorSegmentList` render 次数 **≈ scroll 次数**，非每键一次。
- [ ] 手测：LKB-H6「高亮即时、整体不黏」。

---

## Phase 5 — LKB-2 CI + 清理（**部分完成**）

### Step 5.1 — LKB-2 perf 闸门 ✅

**文件**：[`listKeyboardNavigationBurst.perf.ts`](../../../apps/desktop/src/perf/listKeyboardNavigationBurst.perf.ts)

| 探针 | 标准 |
|------|------|
| LKB-2 burst 末步 | 193 段 · 10 coalesce 步 · **`listCommit` ≤ 120ms** |
| LKB-2 keyup flush | 模拟 keyup 后 **恰好 1 次** SC1 commit |
| LKB-1 | **保留** scroll plan ≤2ms · syncPathTotal ≤80ms（必要非充分） |

### Step 5.2 — working tree 补丁取舍 ⏳

| 补丁 | 处置 |
|------|------|
| `source !== "listKeyboard"` 禁 reveal | ✅ **已回滚**为 `!isListKeyboardBurstStep` |
| keyup-only reveal 无 debounce | ⚠️ 保留 180ms debounce 但 keyup 取消；可简化为 `0` 或移除冗余 timer |
| 去 scroll projection | **保留评估** |
| `keyboard` align / mount fallback | **保留**（scroll 正确性） |
| `syncListKeyboardSegmentFocus` in scroll hook | ✅ **已移除 burst 路径**；keyup 一次 focus |
| `executeEditorShortcut` waveform ↑↓ | **保留**（WL 正交） |
| Step 5 rAF 叙事 | **文档更正**（research §2.2） |

### Step 5.3 — Architecture guard 热点 ⏳

- `useTranscriptionLayerSelection.ts`：482 行 / 14 hooks → 拆分 burst 相关逻辑出独立 hook/module。
- `useEditorSegmentListScroll.ts`：316 行 → 将 layout effect 拆小。
- `listKeyboardNavigationBurst.perf.ts`：326 行 → 拆辅助函数/工厂。

### Step 5.4 — 文档同步 ✅

- 本 plan / acceptance / v0.1.8.1 checklist §6 profile 模板
- `waveform-list-interaction-hand-test-evidence.md` §10–§11

---

## 3. 能力—UI 状态矩阵

| UI / 行为 | 维度 | burst 真源 | keyup / 慢路径 | 手测 |
|-----------|------|------------|----------------|------|
| 列表/波形高亮 | SC2 | chrome store + imperative | reconcile if desync | LKB-H6 |
| 列表 scroll | SC4 | imperative burst scroll + layout effect | layout effect after SC1 | LKB-H1/H7 |
| tier 横向 scroll | reveal | 180ms debounce · chrome idx | keyup 一次 reveal | LKB-H5/H8 |
| undo/save/Tab 上下文 | SC1 | **滞后**（ref 先行） | keyup `startTransition` commit | LKB-H4 |
| textarea focus | a11y | 不变 | keyup 一次 | LKB-H8 |
| 播放头显示 | display playhead | 独立 | 独立 | WL-03 |

---

## 4. 机器闸门

```bash
npm run typecheck
npm run test -w @rushi/desktop -- useEditorSegmentListScroll useTranscriptionLayerSelection useSegmentKeyboard selectionChrome
npm run test:perf -w @rushi/desktop -- listKeyboardNavigationBurst selectionChromeSyncPath
node scripts/check-architecture-guard.mjs
```

**Release**：[`v0.1.8.1-release-hand-test-checklist.md`](./v0.1.8.1-release-hand-test-checklist.md) §1 **LKB-H4/H5/H8 Blocker 全 PASS**。

---

## 5. PR 拆分建议

| PR | 内容 | 可独立签收 |
|----|------|------------|
| **PR-1** | Phase 4 剩余：U11/U12 解耦 + SCB 收束 | H6 + 降 render |
| **PR-2** | Phase 5 清理：guard hotspot 拆分 + U18 profile 噪声 + 补丁取舍 | 防回归 + 可维护性 |

---

## 6. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | v1：虚拟 scroll 薄片 Phase 1 |
| 2026-06-22 | v1 Step 5 rAF（后证伪） |
| 2026-06-21 | **v2 重规划**：LKB-ROOT-1/2/3/4 登记表；Phase 2–5；Phase 1 降级为必要非充分 |
| 2026-06-21 | **§0.1 整树更新矩阵 U1–U20**：必要/可省/burst 禁止；目标态数据流 |
| 2026-06-22 | **v2 代码侧收口**：Phase 2–3 标记 DONE；Phase 4–5 标记 PARTIAL；更新 U1–U20 状态；新增 §5.3 guard hotspot |
