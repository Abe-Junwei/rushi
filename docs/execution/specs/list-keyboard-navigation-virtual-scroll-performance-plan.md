# Plan：列表键盘导航与虚拟滚动性能（v0.1.9 · LKB）

> **Research**：[`list-keyboard-navigation-virtual-scroll-performance-research.md`](./list-keyboard-navigation-virtual-scroll-performance-research.md)  
> **Acceptance**：[`list-keyboard-navigation-virtual-scroll-performance-acceptance.md`](./list-keyboard-navigation-virtual-scroll-performance-acceptance.md)  
> **手测证据**：[`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md)  
> **术语**：[`CONTEXT.md`](../../../CONTEXT.md) — SC4 · listKeyboard · selection chrome

---

## 0. 目标与非目标

### 目标

- 5000 语段下连续 `↑/↓` 导航：首帧可见选中行、虚拟窗不空白、sync path 过 CI 闸门。
- `useEditorSegmentListScroll` 拆出纯函数，消除 architecture guard **>300 行** hotspot。
- 列表容器引入 **CSS containment**（路线 E）。
- 删除已无 caller 的 `imperativeScrollListSegmentIntoView` 死代码。

### 非目标（本薄片）

- 动态行高 L1-B / size cache（DYN-01）
- hover/focus ring 收进 chrome store（CHR-02）
- 第三方虚拟列表库替换
- 列表 Canvas 化

---

## 1. 实现步骤

### Step 1 — 纯函数抽取（路线 A）

1. 新 [`editorSegmentListScrollMetrics.ts`](../../../apps/desktop/src/components/editor/editorSegmentListScrollMetrics.ts) — scroll metrics 读取/比较。
2. 新 [`planEditorSegmentListSelectionScroll.ts`](../../../apps/desktop/src/components/editor/planEditorSegmentListSelectionScroll.ts) — 选中 → scrollTop 计划（无 React）。
3. 新 [`computeEditorSegmentListVirtualWindow.ts`](../../../apps/desktop/src/components/editor/computeEditorSegmentListVirtualWindow.ts) — projection/pin 虚拟窗推导。
4. 精简 [`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts) — 仅保留 effect/state 编排。

**验证**：`npm run test -w @rushi/desktop -- useEditorSegmentListScroll`

### Step 2 — 死代码清理

1. 删除 [`segmentListScrollIntoView.ts`](../../../apps/desktop/src/utils/segmentListScrollIntoView.ts) 内 `imperativeScrollListSegmentIntoView`（v0.1.8.1 已从 listKeyboard 路径移除调用）。

**验证**：`rg imperativeScrollListSegmentIntoView` 无命中

### Step 3 — CSS containment（路线 E）

1. [`EditorSegmentList.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentList.tsx) 滚动根加 `[contain:layout_paint]`。

**验证**：手测 sticky banner + 滚动条无回归（见 acceptance LKB-H2）

### Step 4 — CI perf 探针（LKB-1）

1. 新 [`listKeyboardNavigationBurst.perf.ts`](../../../apps/desktop/src/perf/listKeyboardNavigationBurst.perf.ts)：
   - 5000 段 × 10 步 scroll plan ≤ 2ms/step
   - 193 段 listKeyboard syncPathTotal ≤ 80ms
   - burst 每步 virtual window 含选中行

**验证**：`npm run test:perf -w @rushi/desktop -- listKeyboardNavigationBurst`

### Step 5 — 文档

1. 刷新 research brief §1/§3/§5（对齐 `b68f490`、`e06d0fd`）。
2. 本 plan + acceptance 链接 research。

---

## 2. 能力—UI 对齐

| 路径 | 真源 | UI 期望 |
|------|------|---------|
| listKeyboard 选中 | `useTranscriptionLayerSelection` + chrome store | 选中框即时；列表 scroll 由 `useEditorSegmentListScroll` 单写 |
| 波形 in-viewport 选中 | `shouldSkipListScrollWhenInViewport` | 列表不滚、虚拟窗不 pin 扩 span |
| 播放头显示 | `resolveDisplayPlayheadTimeSec`（`e06d0fd`） | 与列表/波形选中独立，不混用 raw seek time |

---

## 3. 机器闸门

```bash
npm run typecheck
npm run test -w @rushi/desktop -- useEditorSegmentListScroll planEditorSegmentListSelectionScroll
npm run test:perf -w @rushi/desktop -- listKeyboardNavigationBurst
node scripts/check-architecture-guard.mjs
```

---

## 4. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：A+B+E 组合；拆分 scroll hook；LKB-1 perf；删 dead imperative scroll |
