# Plan：Selection Chrome Bus（列表 + 波形选中视觉层）

> **Research**：[`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md)  
> **Acceptance**：[`selection-chrome-bus-acceptance.md`](./selection-chrome-bus-acceptance.md)  
> **术语**：[`CONTEXT.md`](../../../CONTEXT.md) · [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)  
> **前置**：[`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) S0–S11（grill 矩阵 **不变**）  
> **估时**：**~4–5 人日**（单人 2–3 个纵向 PR 或 1 个集成分支）

---

## 0. 目标与非目标

### 目标

1. **选中视觉（SC2）** 与 **逻辑选中（SC1）** 分离：波形 + 列表 chrome **同步 imperative <30ms**。  
2. `selectSegmentAt` **仍是唯一入口**；reveal/seek/focus 策略 **不变**。  
3. 193+ 段：列表选中 **不触发** `EditorSegmentList` 全量 reconcile（React Profiler 可验证，Phase 3）。  
4. 多选、filter、keyboard、merge/delete 后 **chrome 与 React 一致**（reconciliation 层）。  
5. Profile / 手测清单可回归。

### 非目标

| 项 | 原因 |
|----|------|
| tier scroll / WaveSurfer compositor 优化 | 独立薄片；见 scroll profile |
| L1-B/C 列表动态行高 | [`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md) |
| 移除 `selectedIdx` React state | undo/save/keyboard 仍依赖 |
| `WaveformSegmentOverlay` 全 imperative 化 | Phase 5 可选；handles 仍走 React |
| 第二套选中 API | research §4 禁止 |

---

## 1. 架构

### 1.1 数据流（目标态）

```text
selectSegmentAt(idx, source)                    ← 唯一入口（不变）
  │
  ├─ [sync] selectionChromeStore.commit({ primaryIdx, selectedSet, version++ })
  ├─ [sync] applySelectionChromeImperative({ prev, next, multiSet })
  │           ├─ waveform overlay [data-segment-idx]
  │           └─ list [data-seg-row] .seg-row-selected / .seg-row-in-selection
  ├─ [sync] reveal / seek / focus（现有顺序）
  └─ [transition] setSelectedIdx + selectSegmentIndices（React 逻辑态）

React commit 后（慢路径）
  └─ reconcileSelectionChromeFromReact()       ← 仅当 desync 检测失败时修正 DOM
```

### 1.2 状态维度（SC）

| ID | 含义 | 真源 | 消费者 |
|----|------|------|--------|
| **SC1** | 逻辑 primary `selectedIdx` | React `useProjectEditorState` | undo、save、toolbar、keyboard |
| **SC2** | 视觉 chrome | `selectionChromeStore` + DOM | 用户感知高亮 |
| **SC3** | 多选集合 | React `useSegmentSelectionController` → 同步进 store | lasso、Shift range |
| **SC4** | 虚拟窗 scroll 投影 | `useEditorSegmentListScroll` | 仅 scroll 需要时更新 |

**硬规则**

1. SC2 **不得**单独驱动 persist / undo（仅 SC1/SC3）。  
2. 波形点击：**先 SC2 再 SC1**（用户见波形 + 列表同步亮）。  
3. Filter 排除 SC1 时：SC2 **不**画隐藏行；banner 仍用 SC1（现有 S8）。  
4. file switch / segment 结构 mutation 后：**reset store + full reconcile**。

---

## 2. 实现切片（Phase 0–4）

### Phase 0 — Store + 类型（0.5d）

**Step 0.1** 新增 [`selectionChromeStore.ts`](../../../apps/desktop/src/services/selection/selectionChromeStore.ts)

```typescript
type SelectionChromeSnapshot = {
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;  // 含 primary
  version: number;
  fileId: string | null;             // reset on file switch
};

// subscribe / getSnapshot / commitChrome / resetChrome
// useSyncExternalStore 友好：getSnapshot 返回稳定引用仅 version 变时
```

**Step 0.2** 单测：commit、reset、subscribe 通知、同 idx 幂等。

**验证**：`npm run test -w @rushi/desktop -- selectionChromeStore`

---

### Phase 1 — 统一 Imperative Chrome（1.5d）· **SCB-1**

**Step 1.1** 新增 [`applySelectionChromeImperative.ts`](../../../apps/desktop/src/services/selection/applySelectionChromeImperative.ts)

- 吸收 [`applyWaveformSegmentSelectionImperative.ts`](../../../apps/desktop/src/services/waveform/applyWaveformSegmentSelectionImperative.ts)（保留 re-export 兼容 1 PR）。  
- **列表**：对 `[data-seg-row="${idx}"]` 切换 `seg-row-selected` / `seg-row-in-selection`；同步 `overflow`/`z-index`（与 [`EditorSegmentList.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentList.tsx) L254–255 一致，改 imperative 或 CSS `:is([data-chrome-selected])`）。  
- **多选**：对 `selectedSet` 内非 primary 行画 `seg-row-in-selection`；prev set diff 清除 removed indices（最多遍历 prev∪next，大 multi-select 仍 O(k)）。  
- 列表 root：`segmentListRef.current` 或 `.workspace` 下 query。

**Step 1.2** 改 [`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts)

```text
selectSegmentAt 内 flushSelectedIdx 块：
  1. selectionChromeStore.commit(…)
  2. applySelectionChromeImperative(…)
  3. commitSelectedIdxUi (startTransition) — 已有
```

- `selectSegmentIndices` / lasso 路径：在 `useTranscriptionLayer` 或 controller **同样**写 store + imperative（找调用链统一 helper `publishSelectionChromeFromIndices()`）。  
- Profile：新增 span `listChrome`（列表 DOM 部分耗时）。

**Step 1.3** 单测：jsdom 建 `[data-seg-row]` + overlay 节点，断言 class toggle。

**验证**

- `applySelectionChromeImperative.test.ts`  
- 手测 SC-H1（193 段波形连点，列表与波形同步亮）

---

### Phase 2 — 虚拟窗与选中解耦（1d）· **SCB-2**

**Step 2.1** 改 [`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts)

| 条件 | 行为 |
|------|------|
| `source === "waveform"` 且 `scrollSegmentListIndexIntoView` 返回 null | **不** `listScrollCorrect`；**不** `selectionScrollProjectionRef=true`；**不** `bumpScrollEpoch` |
| `source === "list" \| "listKeyboard"` | 保持 P0/S5 语义 |
| 远距需 scroll | 仍 scroll + pin；chrome 已由 Phase 1 即时 |

**Step 2.2** `virtualWindow` useMemo deps：**移除** `selectedDisplayIndex` 作为 pin 触发条件，改为仅 `scrollEpoch` + scroll metrics + filter；pin 选中行改 **按需**（scroll into view 路径内 explicit pin）。

**Step 2.3** 评估 `maybePinSegmentListVirtualWindow` 调用点 — 避免每次 SC1 变更 merge 160 行窗。

**验证**

- 扩展 `useEditorSegmentListScroll.test.ts`  
- Profile：`listCommit` 可仍 ~300ms，但 `listScroll=0` 于波形可见行点击

---

### Phase 3 — 行级订阅（1.5d）· **SCB-3**

**Step 3.1** 新增 [`useSegmentRowSelection.ts`](../../../apps/desktop/src/hooks/useSegmentRowSelection.ts)

```typescript
function useSegmentRowSelection(segmentIdx: number): {
  selected: boolean;
  inSelection: boolean;
}
// useSyncExternalStore(selectionChromeStore.subscribe, () => selector(segmentIdx))
```

**Step 3.2** 改 [`SegmentTextListRow.tsx`](../../../apps/desktop/src/components/SegmentTextListRow.tsx)

- 删除 props `selected` / `inSelection`（或保留 fallback 只给测试）。  
- 内部 `useSegmentRowSelection(i)` 驱动 className。  
- `SegmentRowTimestampColumn` / `SegmentRowTextField` 仍收 `selected` — 来自 hook。

**Step 3.3** 改 [`EditorSegmentList.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentList.tsx)

- `renderSegmentRow` **不再**读 `c.selectedIdx` 传 selected。  
- `EditorSegmentList` 用 `React.memo`  comparator：**排除** `selectedIdx`（仅 segments / filter / virtualWindow / busy）。

**Step 3.4** [`EditorSegmentWorkbench.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentWorkbench.tsx) memo  comparator：评估是否将 `selectedIdx` 从 workbench 级 memo 移除（避免整 workbench 因选中重渲染）。

**验证**

- React Profiler：193 段波形点选，`EditorSegmentList` render count **不增**（或仅 ±2 行）  
- 手测 SC-H2–H5

---

### Phase 4 — Reconciliation + 边界（1d）· **SCB-4**

**Step 4.1** 新增 `reconcileSelectionChromeFromReact.ts`

- 在 `useLayoutEffect`（`EditorSegmentList` 或 dedicated hook）比较 SC1/SC3 vs store snapshot。  
- Mismatch 时 `applySelectionChromeImperative` 全量刷当前 visible rows + overlay（安全网）。  
- Triggers：filter 变更、merge/delete、undo/redo、file open、React strict double-mount。

**Step 4.2** 结构 mutation 后：`selectionChromeStore.reset()` + reconcile（接入 `useSegmentSelectionController` clamp 路径或 file lifecycle）。

**Step 4.3** `focus=selected`：列表点击仍走 React；波形点击 focus shell — **不变**。textarea focus 不依赖 chrome class。

**Step 4.4** Profile 收尾

- Spans：`listChrome` · `listCommit` · `firstPaint`（波形/列表 chrome 时刻）  
- Waveform flush 仍等 `listCommit`（已实现）或改 `syncPathTotal` 单独指标 — 见 acceptance。

**验证**：SC-H6–H12 + 全仓闸门

---

### Phase 5 — 文档 + 守卫（0.5d）· **SCB-5**

**Step 5.1** 更新 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)

- §点选契约：SC1/SC2 二维表  
- 顺序：**SC2 imperative → reveal → SC1 transition**（替换原 flushSync 描述）

**Step 5.2** [`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) 附录：P1 flushSync → Chrome Bus 迁移说明（历史，不删 P0 语义）。

**Step 5.3** 可选 guard：`EditorSegmentList` 外禁止 `classList.toggle('seg-row-selected')`（强制走 service）。

**Step 5.4** DevTools：`__rushiSelectionProfile` 文档串写入 research 链接。

---

## 3. 文件清单

| 文件 | 动作 |
|------|------|
| `services/selection/selectionChromeStore.ts` | 新增 |
| `services/selection/selectionChromeStore.test.ts` | 新增 |
| `services/selection/applySelectionChromeImperative.ts` | 新增 |
| `services/selection/applySelectionChromeImperative.test.ts` | 新增 |
| `services/selection/reconcileSelectionChromeFromReact.ts` | 新增 |
| `services/selection/reconcileSelectionChromeFromReact.test.ts` | 新增 |
| `hooks/useSegmentRowSelection.ts` | 新增 |
| `services/waveform/applyWaveformSegmentSelectionImperative.ts` | 改：re-export 或 thin wrapper |
| `pages/useTranscriptionLayerSelection.ts` | 改 |
| `pages/useTranscriptionLayer.ts` | 改：lasso / multi 写 store |
| `components/editor/useEditorSegmentListScroll.ts` | 改 |
| `components/editor/EditorSegmentList.tsx` | 改 |
| `components/SegmentTextListRow.tsx` | 改 |
| `components/editor/EditorSegmentWorkbench.tsx` | 改 memo |
| `services/ui/selectionLatencyProfile.ts` | 改 |
| `docs/architecture/desktop-waveform-engine.md` | 改 |
| `scripts/check-architecture-guard.mjs` | 可选 |

---

## 4. TDD 顺序（vertical）

```text
1. selectionChromeStore: commit / reset / subscribe
2. applySelectionChromeImperative: list row class toggle (jsdom)
3. applySelectionChromeImperative: waveform overlay (migrate existing tests)
4. useTranscriptionLayerSelection: calls store + imperative before setSelectedIdxUi
5. useEditorSegmentListScroll: waveform + in-viewport skips bumpScrollEpoch
6. useSegmentRowSelection: selector updates on commit
7. reconcileSelectionChromeFromReact: mismatch repair
8. selectionLatencyProfile: listChrome span
9. 全仓 typecheck / test / guard
```

---

## 5. PR 拆分建议

| PR | 内容 | 可独立合并 |
|----|------|------------|
| **PR-1 SCB-0+1** | Store + imperative + selection 内核 | ✅ 最大收益 |
| **PR-2 SCB-2** | 虚拟窗解耦 | ✅ 依赖 PR-1 |
| **PR-3 SCB-3+4** | 行订阅 + reconcile | ✅ 依赖 PR-1 |
| **PR-4 SCB-5** | 文档 + guard | ✅ |

可合并为 **单 PR** 若单人要一次手测闭环。

---

## 6. 回滚

- Store 未 commit 时行为等同现网（仅 React prop 高亮）。  
- Feature flag **非必须**；若需：`localStorage rushi.dev.selectionChromeBus=0` 跳过 imperative（仅 dev 回退）。  
- 回滚后保留 waveform imperative（已独立验证）。

---

## 7. 与相邻薄片关系

| 薄片 | 关系 |
|------|------|
| [`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) | grill 矩阵不变；P1 flushSync 文案过时 → 本 plan 修正 |
| [`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md) L1/L3 | 正交；L3-C flushSync scroll **禁止**与本 plan 并用 |
| [`state-ref-convergence-plan.md`](./state-ref-convergence-plan.md) | SC1 仍 React；不冲突 |
| Scroll unified stage | 不包含 |

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：Phase 0–5 + SC 维度 + PR 拆分 |
