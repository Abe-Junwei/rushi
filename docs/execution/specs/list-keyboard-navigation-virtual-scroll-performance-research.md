# 调研：转写列表键盘快速切换与虚拟滚动性能优化

> **状态**：编码中（2026-06-21 · LKB 薄片）  
> **Plan**：[`list-keyboard-navigation-virtual-scroll-performance-plan.md`](./list-keyboard-navigation-virtual-scroll-performance-plan.md)  
> **Acceptance**：[`list-keyboard-navigation-virtual-scroll-performance-acceptance.md`](./list-keyboard-navigation-virtual-scroll-performance-acceptance.md)  
> **手测证据**：[`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md)  
> **触发**：v0.1.8.1 热修复（`b68f490`）+ v0.1.9 playhead/display 收口（`e06d0fd`）后，补系统性路线对照与 perf CI 闸门。  
> **关联**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md)、`useEditorSegmentListScroll.ts`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 编辑长转写文稿时，用户长按 `↑` / `↓`（或 `Ctrl/Cmd + ↑/↓`）在语段列表中快速跳转。期望：① 选中框即时跟随按键；② 列表滚动顺滑、无瞬跳/空白；③ 播放头/波形选中与列表保持同步；④ 连续按键不丢帧。 |
| **本仓现状（2026-06-21）** | **已落地**：① `listKeyboard` 路径删除重复 `imperativeScrollListSegmentIntoView`（`b68f490`）；② `useSegmentKeyboard` 用 `queueMicrotask` 合并 burst advance；③ virtual window pin 改为 `useMemo` projection；④ selection chrome bus + display playhead API（`e06d0fd`）；⑤ scroll hook 拆分为纯函数（291 行编排层）；⑥ `listKeyboardNavigationBurst.perf.ts` LKB-1 CI；⑦ `EditorSegmentList` `contain:layout_paint`。**仍欠**：① 固定行高 vs 长文本折行（DYN-01）；② hover/focus imperative chrome（CHR-02）；③ LKB-H1–H2 手测 evidence。 |
| **成功标准** | 5000 语段下连续按键 10 次/秒，列表首帧即显示目标行、无空白；`listKeyboardNavigationBurst.perf.ts` 绿；`useEditorSegmentListScroll.ts` 编排层 ≤300 行；typecheck + test + architecture guard 绿。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| **A** | **单一虚拟窗口 + 预计算 projection** | [react-window](https://github.com/bvaughn/react-window)、[Virtua](https://github.com/inokawa/virtua) | 只渲染视口 + overscan；`scrollToIndex` 按键时直接算 `scrollTop` | [react-window docs](https://react-window.vercel.app/) |
| **B** | **键盘导航与滚动写入分离 + imperative 样式** | VS Code / Notion / Linear | 选中只更新逻辑索引 + chrome；滚动由单一 layout effect 写入 | [A11Y roving tabindex](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) |
| **C** | **Canvas/WebGL 批量渲染** | Figma、Audacity | 高频重绘不走 DOM | 不适用转写列表（可编辑 + a11y） |
| **D** | **按键合并 / 单 rAF 时钟** | Descript、WaveSurfer.js | 连续按键合并；播放/滚动单时钟 | **Rushi 政策**：listKeyboard 用 `queueMicrotask` 合并 advance；**禁止** >16ms debounce 跳过中间行；display playhead 已单真源（`e06d0fd`） |
| **E** | **CSS containment** | web.dev 大列表实践 | `contain: layout paint` 隔离列表重排 | [CSS containment](https://web.dev/articles/css-containment) |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 |
|------|--------|----------------|-------------------|
| **A projection** | **高** | `segmentListVirtualWindow.ts` 已是本体；本薄片抽出 `planEditorSegmentListSelectionScroll` | 动态行高需 size cache（DYN-01，非本薄片） |
| **B imperative chrome** | **高** | chrome store + CSP layout 已用于 deselecting；CHR-02 hover/focus 待做 | CSP-HARDEN：仅 `setCspLayoutRules` |
| **C Canvas 列表** | **低** | — | 破坏可编辑性 |
| **D 合并调度** | **中（部分已落地）** | `queueMicrotask` burst coalesce；`visualPlayheadClock` / `resolveDisplayPlayheadTimeSec` | 不用 timer 节流 list 索引 |
| **E containment** | **高（低成本）** | `EditorSegmentList` 滚动根 `[contain:layout_paint]` | sticky banner 需手测 LKB-H2 |

**本仓必须先复用：**
- `segmentListVirtualWindow.ts` / `segmentListScrollIntoView.ts`
- `useEditorSegmentListScroll.ts`（本薄片拆分）
- `selectionChromeStore.ts` + `applySelectionChromeImperative.ts`
- `useSegmentKeyboard.ts` — `queueMicrotask` coalesce
- `waveformDisplayPlayhead.ts` — 显示层 playhead（`e06d0fd`）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **A + B + E**（延续）；**D 仅 microtask coalesce + display playhead**，不用 list 索引 timer |
| **不做什么** | ❌ 列表 Canvas 化；❌ 第三方虚拟库；❌ listKeyboard >16ms 节流；❌ 本薄片不做 DYN-01 / CHR-02 |
| **与架构关系** | SC4 虚拟窗；selection-chrome-bus；display playhead 与 raw seek 分离 |
| **风险** | DYN-01 动态行高；CHR-02 a11y；CNT-03 containment vs sticky |

### 4.1 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| 纯函数 | `planEditorSegmentListSelectionScroll.ts` | 新增 |
| 纯函数 | `computeEditorSegmentListVirtualWindow.ts` | 新增 |
| Hook | `useEditorSegmentListScroll.ts` | 拆分 ≤300 行 |
| UI | `EditorSegmentList.tsx` | `contain: layout paint` |
| Perf | `listKeyboardNavigationBurst.perf.ts` | LKB-1 CI |
| 清理 | `segmentListScrollIntoView.ts` | 删 dead `imperativeScrollListSegmentIntoView` |

---

## 5. 签收

- [x] 调研 brief 完成（2026-06-21 刷新）
- [x] plan / acceptance 已链接本文
- [x] 进入编码（LKB 薄片）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版 |
| 2026-06-21 | 刷新 §1/§3/§4：对齐 `b68f490`/`e06d0fd`；路线 D 明确 microtask 政策；链接 WL 手测 evidence |
