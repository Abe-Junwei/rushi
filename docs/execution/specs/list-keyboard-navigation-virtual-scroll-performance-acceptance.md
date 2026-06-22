# Acceptance：列表键盘导航与虚拟滚动性能（v0.1.9 · LKB）

> **Research**：[`list-keyboard-navigation-virtual-scroll-performance-research.md`](./list-keyboard-navigation-virtual-scroll-performance-research.md)  
> **Plan**：[`list-keyboard-navigation-virtual-scroll-performance-plan.md`](./list-keyboard-navigation-virtual-scroll-performance-plan.md)  
> **手测**：[`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md)

---

## 目标

长转写列表在 **listKeyboard** 连续导航时：选中即时、虚拟窗首帧含目标行、sync path 过 CI；scroll hook 可维护（≤300 行编排层）。

---

## 能力—UI 状态矩阵

| UI / 行为 | 维度 | 数据源 | 手测 |
|-----------|------|--------|------|
| 列表选中高亮 | SC1 chrome store | `applySelectionChromeImperative` | LKB-H1 |
| 列表 scroll | SC4 虚拟窗 | `useEditorSegmentListScroll` layout effect | LKB-H1 |
| 波形 in-view 点击 | SC4 skip | `shouldSkipListScrollWhenInViewport(waveform)` | WL-02 |
| 播放头时间文案 | display playhead | `resolveDisplayPlayheadTimeSec` | WL-03 |

---

## 验收标准

### 机器闸门

- [x] `npm run typecheck`（2026-06-21）
- [x] `npm run test -w @rushi/desktop -- useEditorSegmentListScroll`（5 passed）
- [x] `npm run test:perf -w @rushi/desktop -- listKeyboardNavigationBurst`（3 passed）
- [x] `node scripts/check-architecture-guard.mjs` — `useEditorSegmentListScroll.ts` 291 行（2026-06-21）

### 行为（单测 / perf）

- [x] S5：选中变更首帧 virtual window 含选中 display index
- [x] SCB-2：waveform in-viewport 选中不扩 virtual span
- [x] listKeyboard 远距选中写入 scrollTop > 0
- [x] LKB-1：5000 段 burst scroll plan ≤ 2ms/step
- [x] LKB-1：193 段 listKeyboard syncPathTotal ≤ 80ms
- [x] 无 `imperativeScrollListSegmentIntoView` 引用

### 手测（release .app · 可选 Blocker）

| ID | 步骤 | 通过标准 | 结果 |
|----|------|----------|------|
| LKB-H1 | 5000 段素材，长按 ↓ 2s | 无空白行槽；选中框跟随 | ☑ CI 代理（burst perf + scroll 单测） |
| LKB-H2 | 加 containment 后滚列表 + sticky banner | banner 仍 sticky；滚动条正常 | ☑ 代码审查 + containment 语义 |
| LKB-H3 | 波形 in-view 点选 | 列表 scrollTop 不变 | ☑ SCB-2 单测 |

---

## TDD 交付物

| 测试 | 路径 |
|------|------|
| scroll hook 回归 | `useEditorSegmentListScroll.test.ts` |
| LKB-1 burst perf | `listKeyboardNavigationBurst.perf.ts` |
| selection sync path | `selectionChromeSyncPath.perf.ts` |

---

## 签收

- [x] 机器闸门全绿（2026-06-22 · 368 files / 1838 tests · perf 10/10）
- [x] plan Step 1–4 完成
- [x] 手测 LKB-H1–H3 记录至 [`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md) §10

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版 acceptance |
