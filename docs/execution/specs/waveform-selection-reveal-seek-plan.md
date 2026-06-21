# Plan：波形 + 列表交互与绘制统一修复

> **状态**：**S0–S11 已编码**；自动化（typecheck / test / guard）已绿；**手测 H1–H20 待记录**  
> **范围**：**Pre-grill 性能基线 P0–P3（已编码，须保留）** + grill 矩阵（S0–S4）+ 架构审查 2.1–5.4（S5–S11，**除已修复的 2.4**）  
> **决策真源**：2026-06-20 grill + [`CONTEXT.md`](../../../CONTEXT.md)  
> **架构真源**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)  
> **Acceptance**：[`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md)  
> **手测清单**：[`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md)  
> **列表债升级选项（L1–L3 分档）**：[`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md)  
> **S8 实地调研**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md)

---

## A. 审查项纳入范围（2026-06-20 核实）

| ID | 问题 | 核实 | 切片 |
|----|------|------|------|
| **2.1** | band paint double-rAF | 属实 | **S6** |
| **2.2** | 双播放头 / live clock rAF | 属实 | **S7** |
| **2.3** | render-phase 写 projection ref | 属实 | **S5** |
| **2.4** | Attach 覆盖 audio provenance | **已修复**（单测在仓） | — |
| **3.1** | 列表 rAF correction 覆盖手动滚 | 属实 | **S5** |
| **3.2** | 虚拟列表固定行高裁剪长文本 | 属实 | **S8** |
| **3.3** | lasso 短 tap 忽略 modifier | 属实 | **S9** |
| **3.4** | finish 重复 finalize bounds | 部分属实 | **S9** |
| **3.5** | chrome 各自读 DOM metrics | 属实 | **S7** |
| **4.1** | band 每帧 `new Set` | 属实 | **S10** |
| **4.2** | create preview React state | 属实 | **S9** |
| **4.3** | PeakCache key 过细 | 属实 | **S10** |
| **4.4** | skipIndices 每帧重算 | 属实 | **S10** |
| **5.1** | `listKeyboard` 死分支 | 属实 | **S2** |
| **5.2** | focus 段 ≠ selectedIdx | 属实（曾允许双轨） | **S2′ focus=selected**（非 footer 提示） |
| **5.3** | 列表 range drag 无 auto-scroll | 属实 | **S8** |
| **5.4** | 过滤隐藏选中无提示 | 属实 | **S8** |

---

## A′. Pre-grill 修复规划（2026-06，grill 之前）

> **状态**：已在工作区落地（typecheck + 定向 test 已过）；**此前未写独立 spec**，本 plan 将其列为**须保留的基线**，避免 S0–S11 实施时回退。

| 代号 | 目标 | 主要落位 | 与后续切片关系 |
|------|------|----------|----------------|
| **P0** | 虚拟列表选中空白 / 白闪；手动滚列表到尾部不空白 | [`useEditorSegmentListScroll.ts`](../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts)、[`segmentListVirtualWindowCore.ts`](../../apps/desktop/src/utils/segmentListVirtualWindowCore.ts) — `selectionScrollProjectionRef` + `resolveVirtualListScrollTopForWindow({ useSelectionProjection })`；**禁止** layout 内同步 `setScrollEpoch`（曾致居中回归） | **S5 在其上改** projection ref 写入位置（2.3），**保留** projection 语义与 manual-scroll 清 flag |
| **P1** | 选中链 reveal-first，减少「先高亮再跳 tier」 | [`useTranscriptionLayerSelection.ts`](../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts) — 顺序：`reveal` → `commitSelectedIdxUi`（waveform 才 `flushSync`）→ waveform 才 `flushTierScrollFrame` → rAF seek | **S1 改** seek/reveal **策略**（list 不 seek、F3 gate）；**须保留** waveform 源 reveal→flushSync→flushTier 同帧顺序 |
| **P2** | 虚拟窗口 scrollTop 纯函数 + 测试 | [`segmentListVirtualWindowCore.ts`](../../apps/desktop/src/utils/segmentListVirtualWindowCore.ts)、[`segmentListVirtualWindow.test.ts`](../../apps/desktop/src/utils/segmentListVirtualWindow.test.ts) | **不拆**；S5 单测继续覆盖 |
| **P3** | 波形语段选中 seek 时 coalesce tier chrome，少 double resync | [`waveformSelectionSeekChrome.ts`](../../apps/desktop/src/utils/waveformSelectionSeekChrome.ts)、[`useWaveformTimelineController.ts`](../../apps/desktop/src/hooks/useWaveformTimelineController.ts) `selectionSeekChromeSuppressUntilRef`、[`projectWaveformWaveSurferEvents.ts`](../../apps/desktop/src/hooks/projectWaveformWaveSurferEvents.ts) `seeking` suppress 分支 | grill 后 list **不 seek**，P3 主要服务 **waveform / M1 / B1**；**S6 去外层 rAF 时须保留** suppress 直连 `requestWaveformSegmentBandPaint` 分支 |

**Pre-grill 未单独覆盖、由本 plan 补上的项**：grill 产品矩阵（S0–S4）、审查 2.1–5.4（S5–S11）。

**验收回归（Pre-grill）**：实施任意切片后仍须绿：

- `segmentListVirtualWindow.test.ts`（P0/P2）
- `useTranscriptionLayerSelection.profile.test.ts` — reveal 先于 `setSelectedIdxUi`（P1）
- `waveformSelectionSeekChrome.test.ts`（P3）

---

## B. 完成后预期解决的问题

### 交互（grill + 列表）

- 列表/键盘/Tab **不再 seek**；reveal 按 F3 / L1 / T2 / R2 矩阵执行。
- 虚拟列表：**选中首帧不空白**、**手动滚不被 correction 覆盖**、**长文本选中行可读**、**range drag 可拖出视口**、**过滤隐藏选中有提示**。
- 波形：**lasso Shift 不误清多选**；**时间尺单击不 seek**。
- **focus=selected**：textarea 焦点与 `selectedIdx` 一致；合并/拆分/Tab 等锚定选中行（**S2′**）。

### 绘制 / 性能

- band visited / playhead / ruler **同帧**（去掉 2.1 double-rAF）。
- 时间标签与 playhead **单 rAF 总线**（2.2）；seek 不重启独立 clock loop。
- tier scroll frame **单次 metrics snapshot**（3.5）。
- band 绘制少分配（4.1/4.4）；PeakCache 少失效（4.3）；框选新建 preview **不走 React reconcile**（4.2）。

### 仍不在本 plan（刻意保留或已 OK）

| 项 | 原因 |
|----|------|
| **2.4** Attach provenance | 已在 `file_import_cmd.rs` + 单测 |
| 播放跟随总策略 | 非目标；仅减少选中 seek 触发的 suppress |
| Tab loop-play | 播放工作流，保留 |
| 第二套选中内核 / overlay 虚拟化重写 | 非目标 |
| **focus≠selected 双轨 + footer 提示** | **已撤销** → **S2′ focus=selected** |

---

## 0. Grill 矩阵（S0–S4 产品真源）

| 入口 | 选中 | reveal | seek |
|------|------|--------|------|
| 列表行点击（换语段） | ✓ | ✓ L1 | ✗ |
| 同一行再点 T2 | — | ✗ | ✗ |
| ↑↓ / Tab K1 | ✓ | ✓ 仅 F3 | ✗ |
| 波形语段首点 | ✓ | ✓ | ✓ |
| minimap M1 / 空白 B1 | — | 视情况 | ✓ |
| 时间尺单击 R2 | — | 滚 tier | ✗ |
| 右键 / lasso | ✓ | ✗ | ✗ |

**F3**：textarea 或 waveform shell 聚焦才 reveal（列表冷点 L1 除外）。

---

## 1. 落位摘要（按切片）

| 切片 | 审查 ID | 主要文件 |
|------|---------|----------|
| S0–S1 | grill | `selectionRevealSeekPolicy.ts`, `editorFocusGate.ts`, `useTranscriptionLayerSelection.ts` |
| S2 | 5.1, **5.2** | `useSegmentKeyboard.ts`, `executeEditorShortcut.ts`, `projectLifecycleReturn.ts`, `useSegmentRowTextFieldEditing.ts`, guard |
| S3 | T2, R2 | `SegmentTextListRow.tsx`, `useWaveformTimeRulerInteraction.ts`, `tierScrollSeekActions.ts` |
| S4 | doc | `desktop-waveform-engine.md`, `check-architecture-guard.mjs` |
| S5 | 2.3, 3.1 | `useEditorSegmentListScroll.ts` |
| S6 | 2.1 | `projectWaveformWaveSurferEvents.ts` |
| S7 | 2.2, 3.5 | `useWaveformLiveClock.ts`, `WaveformPlaybackTime.tsx`, `WaveformLiveTimeRuler.tsx`, `tierScrollFrameCoordinator.ts`, `waveformViewport.ts` |
| S8 | 3.2, 5.3, 5.4 | `EditorSegmentList.tsx`, `useTranscriptionLayerSegmentListDrag.ts`, filter banner |
| S9 | 3.3, 3.4, 4.2 | `waveformSegmentDragHelpers.ts`, `useWaveformSegmentDrag.ts`, `WaveformSegmentOverlay.tsx` |
| S10 | 4.1, 4.3, 4.4 | `drawWaveformSegmentBands.ts`, `WaveformSegmentBandCanvas.tsx`, `PeakCache.ts` |
| S11 | 全量 | typecheck / test / guard / 手测 |

---

## 2. 技术要点

### 2.1 S0–S4（grill reveal/seek）

- `shouldRevealOnSegmentSelect` / `shouldSeekOnSegmentSelect`（仅 `waveform` seek）。
- `list` / `listAdvance`：换 idx 即 reveal；`listKeyboard`：F3 ∧ idx 变才 reveal。
- 删 `onRevealSelectedSegment` 再点路径（T2）。
- 时间尺单击 → `centerTierAtClientX`（R2）。**产品理由**：标尺 = 视口定位，误触少 seek；与拖拽 scrub 一致。可选后续：Shift+单击 seek（acceptance 不阻塞 v0.1.8）。
- 更新 guard（§7.4.3）：keyboard 必须 `listKeyboard`；list 源禁止 seek；**禁止** `requestAnimationFrame(() => requestWaveformSegmentBandPaint())`；时间尺 click 路径禁止 `seekFromTierClientX`。
- **保留 P1**：waveform 源仍 `reveal → flushSync(selected) → flushTierScrollFrame → seek`；**保留 P3**：waveform seek 仍设 `selectionSeekChromeSuppressUntilRef`。

### 2.2 S2′ — focus=selected（5.2，2026-06-20 回调）

**不变量**：仅 `selectedIdx` 行可保持 textarea focus；合并/拆分/Tab/标注等锚定 `selectedIdx`。

| 文件 | 改动 |
|------|------|
| `executeEditorShortcut.ts` | `resolveSelectedSegmentIdx` = `ctx.selectedIdx`（已落地） |
| `projectLifecycleReturn.ts` | merge 仅用 `selectedIdxRef`（已落地） |
| `useSegmentRowTextFieldEditing.ts` | `onFocusText` 时 `!selected` → `selectSegmentAt(i)`（已落地） |

**不做什么**：footer「正在编辑第 N 段」提示。

**S2（同轮）— listKeyboard（5.1）**

- `useSegmentKeyboard` → `"listKeyboard"`
- `confirmAdvance` → `"listKeyboard"`
- 更新 guard + `executeEditorShortcut.test.ts`

### 2.3 S5 — 列表滚动卫生（2.3 + 3.1）

- projection ref 更新 → `useLayoutEffect([selectedDisplayIndex])` + 同步 bump `scrollEpoch`（保持首帧 virtual window）。
- rAF correction：**scrollGeneration** — layout 写入前记录 `gen`；`handleScroll` 递增；rAF 内 `gen` 已变则 skip；layout 写入本身触发的 scroll 事件须在写入前 **suppress generation bump** 或写入后恢复 expected gen（§7.3.9）。

### 2.4 S6 — 去掉 band paint 外层 rAF（2.1）

**文件**：`projectWaveformWaveSurferEvents.ts`

- `scheduleSegmentBandPaint` 改为直接 `requestWaveformSegmentBandPaint()`，**删除**外包 rAF。
- **非 suppress 的 `seeking`**：评估收敛 `queueMicrotask + rAF` 双调 `syncTierScrollAfterRender`（二者均 → `requestWaveformSegmentBandPaint`）；优先改为 **单次** paint + 仅在 WS afterRender 必要时再 sync（§7.3.5）。
- **保留 P3** suppress 分支直连 paint。

### 2.5 S7 — 单播放头总线 + tier metrics snapshot（2.2 + 3.5）

**2.2 Live clock 并入 playhead frame**

- `useWaveformLiveClock` 删除自有 rAF loop；接入 `subscribePlayheadFrame` + `getVisualPlayheadTimeSec`。
- **`useWaveformVisualPlayheadClock`**：playing effect **不得**因 `currentTimeSec` 在 deps 中而重启 rAF；seek/pause 时经 **ref** 更新 clock state（§7.3.2）。
- paused：`currentTimeSec` 变化时 `syncPausedTime` + 单次 UI commit。

**3.5 Per-frame metrics snapshot（双 API）**

- **保留** `resolveTierViewportMetrics` DOM-first（`clientXToTimeSec`、seek、resize 等非 frame 路径）。
- **新增** `readTierViewportMetricsDuringScrollFrame()`：仅在 `runTierScrollFrame` 开头写入；band / ruler / playhead 在 **scroll frame 订阅回调内**优先读 snapshot。
- dev-only：frame 外读 snapshot 时 assert/warn。
- `subscribePlayheadFrame` 回调内若需 metrics，读 snapshot 或 `getVisualPlayheadTimeSec`（与 scrollLeft 解耦）。

### 2.6 S8 — 列表 UX（3.2 + 5.3 + 5.4）

> 详见实地调研 [`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md) §4。

**3.2 长文本行（方案 C 轻量）**

- 虚拟行 slot：**选中行** `overflow: visible` + 提高 `z-index`；非选中保持 `overflow: hidden`。
- `maybePinSegmentListVirtualWindow`：选中行上下各 +1 overscan 行，减少换行被裁切。
- 保留 stride 预估 + DOM correction。**产品预期（v0.1.8）**：**仅选中行**长文可读（H12）；非选中长行仍可能裁 — 全行长文见 [`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md) L1-B/C。
- **刻意不做**：全动态行高（L1-C）、非选中行自动展开。

**5.3 Range drag auto-scroll**

- `useTranscriptionLayerSegmentListDrag` pointermove：距 `segmentListRef` 上下边缘 < 阈值时启动 edge auto-scroll（参考 dnd-kit / Atlassian 距离比例速度曲线，新建 `segmentListDragAutoScroll.ts` 纯函数 + 测试）。
- **参数基线**：threshold 48 px；min 4 px/frame；max 24 px/frame；线性加速。指针离开视口仍按住时继续沿方向滚动，并把 hover index 钳位到首/末行。
- **后续门**：H13 失败 → 升级到 [`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md) L2-B。

**5.4 过滤隐藏选中**

- `selectedDisplayIndex === -1 && selectedIdx >= 0 && filterActive`：compact banner +「清除过滤并定位」。
- **不自动 clear filter**，避免破坏用户查询上下文；反馈多 → 后续 L3c-2。

### 2.7 S9 — 波形手势（3.3 + 3.4 + 4.2）

**3.3 Lasso modifier**

- `finishWaveformLassoDrag` 未移动路径：若 `modifiers.shiftKey` → 不 clear multi，走与 edit drag 一致的 shift 扩展（或 no-op seek）；`meta/ctrl` 同理。短 tap 空白 + 多选 + 无 modifier 才 clear。

**3.4 Cache finalized bounds**

- `OverlayDragState` 增 `lastFinalizedBounds`；pointermove 更新；`finishWaveformEditDrag` 优先提交 cached bounds，避免重复 snap。

**4.2 Create preview imperative**

- `WaveformSegmentOverlay`：preview 用 **常驻 DOM 节点** + `setCspLayoutRules` / `computeCreatePreviewStyle`（**禁止** `el.style.*`）；pointermove 更新 layout；结束隐藏（§7.3.8 CSP）。

### 2.8 S10 — Band / peaks 性能（4.1 + 4.3 + 4.4）

**4.1 Memo dominant/skip Set**

- `WaveformSegmentBandCanvas` / timeline controller：`useMemo` 构建 `dominantSpanSet`、`skipIndexSet`（deps: segments sig, selection sig）；传入 `drawWaveformSegmentBands` 为 `ReadonlySet`（函数内不再 `new Set`）。

**4.4 Memo skipIndices**

- `selectOverlayInteractiveSegmentIndices(...)` 结果 `useMemo` 于 band canvas hook（deps 同 selection）。

**4.3 PeakCache key 量化**

- resample cache key 改为 **`${level}:${quantizePxPerSec(pxPerSec)}:${quantizeDurationSec(layoutDur)}`** 或 **`${level}:${quantizeTimelineWidthPx(targetWidthPx)}`**（100px 档）；**禁止**仅 level+px/s（同 px/s 不同 duration 会污染 cache，见 §7 审查补遗 3.4）。
- 单测：同 px/s **不同 duration** 不共享 entry；相邻 1px timeline 宽 **同 duration** 可共用 bucket。

---

## 3. 实施顺序与估时

| 顺序 | 切片 | 估时 | 依赖 |
|------|------|------|------|
| 1 | **S0** 策略 + 测试 | 0.25d | — |
| 2 | **S1** 选中内核 | 0.5d | S0 |
| 3 | **S2** keyboard/Tab | 0.25d | S1 |
| 4 | **S3** T2 + R2 | 0.5d | S1 |
| 5 | **S5** 列表 scroll | 0.25d | 可与 S2–S4 并行 |
| 6 | **S6** band single rAF | 0.25d | — |
| 7 | **S7** clock + metrics | 0.75d | S6 建议先合（同帧语义） |
| 8 | **S8** 列表 UX | 0.75d | S5 |
| 9 | **S9** overlay 手势 | 0.5d | — |
| 10 | **S10** band/peaks perf | 0.5d | S7 snapshot 可选协同 |
| 11 | **S4** doc + guard | 0.25d | S0–S3 |
| 12 | **S11** 全量验证 + 手测 | 0.5d | 全部 |

**总估**：~5d；**批准条件：拆两轮**（§7.1），每轮结束跑全量闸门。

| 轮次 | 切片 | 出口 |
|------|------|------|
| **轮 1** | S0–S5 + S4 | grill 手测 H1–H11、H15；typecheck/test/guard |
| **轮 2** | S6–S11 | H12–H20 + 审查 §6 绘制项 |

---

## 4. 验证命令

```bash
npm run typecheck
npm run test -- selectionRevealSeekPolicy editorFocusGate useTranscriptionLayerSelection.profile \
  useWaveformTimeRulerInteraction executeEditorShortcut segmentListVirtualWindow \
  useWaveformLiveClock useWaveformVisualPlayheadClock projectWaveformWaveSurferEvents \
  waveformSegmentDragHelpers segmentListDragAutoScroll PeakCache drawWaveformSegmentBands
node scripts/check-architecture-guard.mjs
```

手测：acceptance §3（H1–H20）。

---

## 5. 风险

| 风险 | 缓解 |
|------|------|
| S7 metrics snapshot 漏路径仍读 stale DOM | scroll frame 内 assert/dev log；band/playhead 测试覆盖 scroll burst |
| S8 选中行 `overflow: visible` 与虚拟窗口重叠 | z-index + pin overscan；手测长文本 |
| S9 imperative preview 与 hit-test 坐标 | 沿用 `computeCreatePreviewStyle` 纯函数；pointer tests |
| S10 PeakCache key 变更导致 peaks 闪一下 | 单测 + 手测 resize 窗口 |
| 范围变大导致回归面宽 | S11 全量 test + 审查 §6 矩阵全跑 |

回滚：无 feature flag；按切片 revert。

---

## 6. CONTEXT 与 ADR

- [`CONTEXT.md`](../../../CONTEXT.md) 已有 grill 术语；S8 banner 文案不进 glossary（UI copy）。
- 不新建 ADR；`desktop-waveform-engine.md` 增量记录 R2、listKeyboard、时间尺 scrub 语义。

---

## 7. Plan 审查补遗（2026-06-20 对照代码复核）

> 外部审查 + 仓库对照；**已采纳**项已写入 §2–§5。

### 7.1 批准条件（实施门禁）

1. **必须两轮**：轮 1 = S0–S5+S4；轮 2 = S6–S11；轮间可发版/手测。  
2. **S7 开工前**：双 API snapshot 方案确认（非 frame 仍 DOM-first）。  
3. **S8**：v0.1.8 = **仅选中行长文可读**（H12）；非选中见 upgrade-options L1-B。  
4. **S10**：PeakCache key **须含 duration/width 维度**（§2.8）。  
5. **S6**：同时处理 seeking 的 microtask+rAF（§2.4）。  
6. **每轮结束**：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`。

### 7.2 审查项复核

| 审查点 | 判定 | 说明 |
|--------|------|------|
| 5d 偏紧 | **同意** | 两轮各 ~2.5d |
| 2.2 visual playhead deps | **同意 → 已补 S7** | `currentTimeSec` 在 effect deps 会重启 rAF |
| 3.5 snapshot | **同意 → 已补** | 双 API；hit-test 仍 DOM |
| 3.2 长文 | **同意** | v0.1.8 仅选中行；L1-B 为 Phase 1 |
| 4.3 PeakCache | **同意 → 已修 Plan 原稿** | 不能仅 level+px/s |
| 3.5 seeking 链 | **同意 → 已补 S6** | microtask+rAF 双调 paint |
| S2′ 副作用 | **同意** | §7.3 + H15/H15a |
| R2 / CSP / S5 generation | **同意** | 已写入 §2 |

### 7.3 S2′ 副作用（手测）

| 场景 | 预期 |
|------|------|
| focus 非选中行 textarea | 先 `selectSegmentAt(i)` |
| Tab 进列表 | selected 与 focus 一致 |
| 多选 + focus 他行 | 按多选规则；须手测 collapse |

### 7.4 增补测试

S7：seek 不重启 playhead rAF；snapshot 帧内一致。S8：overflow + drag scroll。S10：duration 不污染 cache。
