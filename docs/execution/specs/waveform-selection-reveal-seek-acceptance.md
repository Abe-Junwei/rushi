# Acceptance：波形 + 列表交互与绘制统一修复

> **Plan**：[`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md)  
> **S8 实地调研**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md)  
> **状态**：自动化已绿；**手测 H1–H20 Go**（2026-06-20 · [`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md)）

---

## 1. 能力—UI 行为矩阵（grill + 列表）

| 用户动作 | 列表 | 波形 tier | 播放头 | 切片 |
|----------|------|-----------|--------|------|
| Hub 点语段 / ↑↓ / Tab | 见 grill 矩阵 | F3/L1 | **列表导航不 seek** | S0–S2 |
| 同一行再点 | focus | **不滚** | 不动 | S3 |
| 时间尺单击 | — | 滚 | **不动** | S3 |
| 选远处后立刻手动滚列表 | 跟手 | — | — | S5 |
| 长文本选中行滚动 | **正文可见** | — | — | S8 |
| 列表 range drag 到边缘 | **auto-scroll** | — | — | S8 |
| 过滤隐藏当前选中 | **banner + 清除** | — | — | S8 |
| focus 段 ≠ selectedIdx | **focus=selected**（S2′） | — | — | S2′ |
| 播放中 zoom/seek | — | band 与 playhead **同帧** | 同步 | S6–S7 |
| Shift + 空白短 tap（多选） | — | **不清空** | — | S9 |
| 框选新建大范围 | preview **不卡** | — | — | S9 |

---

## 2. 自动化验收

### 2.0 Pre-grill 基线回归（P0–P3，任意切片后仍须绿）

- [x] `segmentListVirtualWindow.test.ts` — projection / virtual window（P0/P2）
- [x] `useTranscriptionLayerSelection.profile.test.ts` — reveal 先于 `setSelectedIdxUi`（P1）
- [x] `waveformSelectionSeekChrome.test.ts` — suppress 窗口（P3）

### 2.1 新增（按 plan 切片）

- [x] `selectionRevealSeekPolicy.test.ts` / `editorFocusGate.test.ts`（S0）
- [x] `tierScrollSeekActions` 或 ruler：`centerTierAtClientX` 不 seek（S3）
- [x] `projectWaveformWaveSurferEvents` 或等价：band paint 无 double-rAF（S6）
- [x] `useWaveformLiveClock.test.ts`：playing 时无独立 rAF，仅 subscribe 回调（S7）
- [x] `segmentListDragAutoScroll.test.ts`（S8）
- [x] lasso modifier test（S9）
- [x] `PeakCache` quantized key test（S10）

### 2.2 更新

- [x] `useTranscriptionLayerSelection.profile.test.ts`（S1）
- [x] `executeEditorShortcut.test.ts` — focus=selected（S2′，已落地）
- [x] `executeEditorShortcut.test.ts` — Tab → `listKeyboard`（S2）
- [x] `SegmentTextListRow` — T2 无 reveal（S3）
- [x] `segmentListVirtualWindow.test.ts` + `useEditorSegmentListScroll.test.ts` — projection + manual scroll（S5）
- [x] `useWaveformVisualPlayheadClock.test.ts` — 与 live clock 无双重 tick（S7）
- [x] `drawWaveformSegmentBands.test.ts` — 接受外部 Set，无内部分配断言（S10）

### 2.3 守卫与类型

- [x] `check-architecture-guard.mjs` 0 error（S4）
- [x] `npm run typecheck`

---

## 3. 手测矩阵

> **清单模板（逐步操作 + 汇总矩阵）**：[`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md)  
> **签收**：2026-06-20 **Go** — H1–H20 全 PASS；P0（H1、H2、H4、H7、H10、H13、H16–H18）无 FAIL。

### Grill + 列表（S0–S5, S8）

| # | 场景 | 期望 |
|---|------|------|
| H1 | Hub 点语段 | tier 对准；**播放头不跳** |
| H2 | textarea ↑↓ | F3 reveal；**不 seek** |
| H3 | 同一行再点 | **tier 不抖** |
| H4 | 波形语段 / minimap / 空白 | seek 按 M1/B1 |
| H7 | 时间尺单击 | tier 滚；**不 seek** |
| H8–H9 | Tab / loop-play | K1 + loop 例外 |
| H10 | 500+ 段虚拟列表 | 无空白 |
| H11 | 选中后立即手动滚列表 | correction 不覆盖 |
| H12 | 多行换行语段（**选中行**）上下滚动 | **仅选中行**正文可读；非选中长行允许被裁（v0.1.8 预期） |
| H13 | range drag 拖过列表底/顶 | 列表 **auto-scroll**（S8） |
| H14 | 过滤掉当前选中 | **banner** + 清除并定位（S8） |
| H15 | focus=selected | 选中段 0、DOM focus 在段 1 textarea → merge/split 作用 **段 0**；点击段 1 正文应先选中段 1；多选场景手测 | S2′ |
| H15a | a11y / Tab 进列表 | Tab 到语段 textarea 与 selectedIdx 一致；无意外 reveal（失焦 shortcut 场景） | S2′ |

### 波形绘制（S6–S7, S9–S10）

| # | 场景 | 期望 |
|---|------|------|
| H16 | 播放中 zoom in/out | WS progress / playhead 同帧落位，无明显撕裂（band 无 visited 语段色） |
| H17 | seek / 点选语段 | band **立即**重绘 |
| H18 | 长音频快速横滚 tier | band 与 tier **同步** |
| H19 | Shift + 空白短 tap（已多选） | **不清**多选（S9） |
| H20 | 波形拖拽新建大段 | preview **流畅**（S9） |

---

## 4. 文档

- [x] `desktop-waveform-engine.md` §点选矩阵 + scroll frame / live clock 说明
- [x] `CONTEXT.md` 与实现一致（Selection reveal、Editor focus gate、Focus–selection lock、Waveform scrub seek）

---

## 5. Done 定义

1. Plan §A 除 **2.4** 外全部条目有对应测试或手测行。  
2. `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过。  
3. 手测 H1–H20 记录 → [`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md)（**Go 2026-06-20**；可并入 v0.1.8 checklist）。  
4. 代码检索：`selectSegmentAt` + `list|listAdvance|listKeyboard` 路径 **无** `seek(`。
