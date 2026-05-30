# 波形区 audit log（累积）

## 本轮已修复

| # | 原级 | 发现 | 处置 |
|---|------|------|------|
| F1 | P0 | `useTierScrollSync` 程序化 `scrollLeft` 写入触发 `onTierScroll`，误刷新 `playbackFollowSuppressUntilRef`，播放跟随断续 | ✅ `programmaticScrollUntilRef` 80ms 窗口内不 suppress |
| F2 | P1 | `mediaUrl` 切换时 `peaks.status.durationSec` 闪回旧时长 | ✅ `useWaveformPeaks` mediaUrl 变更清空 cache；metrics 仅在 `wf.isReady \|\| peakCache` 时用 peaks duration |
| F3 | P1 | `mediaUrl` 切换在 defer mount 期间 scroll 不重置，minimap/ruler 错位 | ✅ 独立 layoutEffect 在 mediaUrl 变更时强制 `scrollLeft=0` |
| F4 | P2 | 关「后台 peaks」仍显示「正在生成波形…」 | ✅ `resolveWaveformPeaksPhase` + `EditorWaveformPane` 按 `backgroundPeaksEnabled` 抑制 |
| F5 | P2 | 窗口变窄后 fit-all clamp 不更新 | ✅ fit-all / media zoom reset 依赖 `tierScrollLayout.clientWidthPx` |
| F6 | P1 | defer 无超时，ensure 挂起时永不挂载 | ✅ 90s 超时降级 decode + toast |
| F7 | P1 | 4h VBR mismatch 二次 force 全量再生 | ✅ `shouldForcePeaksRegenerate` |
| F8 | P2 | L2 到达时 mount 重建 WS | ✅ mount 去 peakCache dep + `peakCacheGeneration` |

## 开放发现（见 fix-backlog.md）

| # | 级 | 文件 | 摘要 |
|---|-----|------|------|
| 1 | ~~P1~~ | defer 超时 | ✅ F6 |
| 2 | ~~P1~~ | 4h force 再生 | ✅ F7 |
| 3 | P1 | `PeakCache.ts` | L2 后台加载前高 zoom 仅能用 L1 |
| 4 | P1 | `useWaveformZoomSync.ts` | peaks-at-create 后仍可能多余 `ws.load` |
| 5 | P1 | `EditorWaveformPane.tsx` | contextMenu 应下沉 controller |
| 6 | ~~P2~~ | mount 重建 WS | ✅ F8 |
| 7 | P2 | `WaveformSegmentOverlay.tsx` | 无语段虚拟化，5000+ 语段 DOM 压力 |
| 8 | P2 | `waveform_peaks_generate.rs` | 单线程解码，4h 首次 30–90s+ |
| 9 | P2 | `useWaveformTimelineController.ts` | mega-controller（8 子 hook），建议按 peaks/scroll/zoom 拆分 |
| 10 | P3 | — | 无 E2E smoke |

## 轮次记录

### 轮次 0（基线）

- typecheck / 372 tests / arch-guard 2 warnings / cargo peaks 9 tests
- 死代码扫描：legacy canvas 路径零引用

### 轮次 1–2（数据流 / 挂载）

- 确认 `useWaveformTimelineController` 为唯一装配点
- defer mount + peaks-at-create 与文档一致
- 发现 F2、F3、开放项 #1 #5 #6

### 轮次 3–4（Peaks / Zoom）

- L0+L1 bootstrap + L2 `loadLevels` 已落地
- `peaksLoadSeqRef` 守卫存在
- 开放项 #2 #3 #4

### 轮次 5（滚动 / fit）

- tier 为水平真源；`autoScroll: false` 无 `setScroll` 残留
- 修复 F1、F3、F5

### 轮次 6（Overlay）

- overlay 全量 DOM map；lane 分配 O(n log n)
- 坐标经 `waveformProjection` — 一致

### 轮次 7（UI / 阶段）

- 修复 F4；toolbar 偏好接线正确
- `WaveformTimeRuler` 仅绘制可见 tick — 良好

### 轮次 8（测试 / backlog）

- 新增测试：`useTierScrollSync` suppress、`waveformPeaksPhase` 两例
- 输出 fix-backlog + hand-test-matrix
