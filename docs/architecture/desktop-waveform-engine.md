# 桌面端波形引擎（P1–P5′）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  WaveformPeaksViewportLayer + WaveformPeaksCanvas  ← 可见 peaks 绘制（P3）
  useProjectWaveform + WaveSurfer                     ← 播放 / seek / 无 peaks 回退 decode
  useWaveformZoomSync                                 ← px/s 变更时 resample+load；peaks 路径 skip ws.zoom
  WaveformSegmentOverlay                              ← 语段 DOM（P4，非 WS Regions）
```

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、Canvas draw、ruler、全局条视口框）。
- WaveSurfer 内部 scroll 通过 `useTierScrollSync` 同步，不反向驱动语段位置。

## Peaks layer 挂载契约（2026-05 根因修复 + 手动 sticky）

**`WaveformPeaksViewportLayer` 挂在 `tierScrollRef` 内部、宽内容之前**，外壳用 **手动
sticky**（订阅 tier `scroll` + `transform: translateX(scrollLeft)`）贴在视口左边。

舞台 DOM：

```text
<div ref=tierScrollRef overflow-x:auto>          ← tier
  <peaks-anchor absolute;left:0;top:0;          ← 手动 sticky，z=1
                width:vw;height:heightPx;
                transform:translateX(scrollLeft)>
    <Canvas width:vw height:heightPx />          ← 撑满视口
  <wide-content inline-block width=timelineWidthPx z=1>  ← 滚动内容
    ... segments (z=3) / ws (z=0) / ruler (z=10)
</div>
```

**根因排查（2026-05 多轮）**：

1. CSS `position:absolute` 在 `overflow-x:auto` 父内随**内容坐标**定位，会随宽内容
   横向滚出视口 → 长音频滚到后部 canvas DOM 物理上在视口外。
2. 改用 wrapper + `absolute inset-0` 让 tier 脱离自身坐标 → 破坏 tier 尺寸读取链路，
   `clientWidth` 异常，layout 整体崩。
3. 改用 CSS `position:sticky` + `inline-block` + `width:0` → 部分场景下 sticky 首次
   生效后失效（peaks "闪一下消失"），inline 上下文里 sticky 行为不稳定。
4. **手动 sticky**（当前方案）：layer 用 `position:absolute`（content 坐标），订阅
   tier `scroll`，每帧用 `transform: translateX(scrollLeft)` 抵消内容平移 → 视觉上
   始终钉在视口左边，跨浏览器一致，无 CSS sticky 的隐式条件。

**绘制**：Canvas 通过 `readScrollLeftPx()`（= `tierScrollRef.current.scrollLeft`）
+ 内部 scroll 监听重绘可见切片。layer 物理位置由 transform 跟随，Canvas 内容由
slice 计算切片，两条路径独立都正确。

**z-index**：peaks layer 与 wide-content 同 z=1，source order peaks 在前 →
wide-content (含 segments z=3 / ruler z=10) 自然覆盖在 peaks 之上。

## 偏好（localStorage）

| Key | 含义 |
|-----|------|
| `rushi.p1.waveformPxPerSec` | 横向缩放 |
| `rushi.p1.waveformHeightPx` | 主波形高度 |
| `rushi.p1.autoFitSelectionToViewport` | 跟随语段模式 |
| `rushi.p1.waveformGlobalStripCollapsed` | 全局条折叠（持久化，换文件不强制展开） |
| `rushi.p1.waveformGlobalPlaybackRate` | 全局播放速度（主 transport） |
| `rushi.p1.tabAdvanceLoopsSegment` | Tab 切段并播放时自动语段循环（默认开） |

## 播放头与全局条

- **主波形** playhead 由 `WaveformTimeRuler` / `WaveformLiveTimeRuler` 绘制；播放或缩放拖动时 `liveViewport` 拉高 tier scroll 采样率（`useWaveformViewportMetrics`）。
- **全局条展开**时另有 minimap playhead（`WaveformOverviewStrip`）；**折叠**后 minimap 隐藏，**主区 playhead 仍可见、仍随播放更新**。
- 选中语段后 seek 到 **语段起点**（非中点）。

## 已知限制

- 生产路径为 **PeakCache + WaveformPeaksCanvas + hook 编排**（`useProjectWaveform`、`useWaveformZoomSync`、`useTranscriptionViewportFit`）；曾规划的 `WaveformEngine` facade 已移除（2026-05-28，无接线）。
- WS 仍负责 MediaElement 播放与无 peaks 时的 decode 波形。
- peaks 为 mono mixdown。

## 相关 spec

- `docs/execution/specs/waveform-engine-refactor-acceptance.md`
- `docs/execution/specs/waveform-engine-refactor-p5-global-strip.md`
- `docs/execution/specs/waveform-engine-refactor-p6-overlay-split.md`
