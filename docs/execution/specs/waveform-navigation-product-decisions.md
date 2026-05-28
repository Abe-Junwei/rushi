# 波形导航产品决策（2026-05-28）

> 用户拍板记录；实现与手测以此为准。

| # | 议题 | 决策 |
|---|------|------|
| 1 | 缩放 UI | **两种模式**：手动缩放 / 跟随语段；全文件导航用 **全局波形条**（无「整段概览」按钮） |
| 2 | 换文件 zoom | **B**：每次换 `mediaUrl` 回到 56 px/s（100%） |
| 3 | 跟随语段换段 / 切模式 | **维持现状**：`resolveSelectionFitPxPerSec`（能放下只滚）；**禁止**切模式时 `forceFullFit` |
| 4 | footer 显示 | **A**：footer 只显示导航模式；缩放条保留 `%` + `px/s` |
| 5 | 全局变速 | **v1 做**；放在播放区全局播放按钮右侧 |
| 6 | WaveformEngine | **B 已执行**：删除未接线 `WaveformEngine` / `WaveformViewport`（2026-05-28） |
| 7 | 全局条折叠 | **记住折叠**；换文件不强制展开 |

## 波形架构真源

`PeakCache` + `WaveformPeaksCanvas` + `useProjectWaveform` / `useWaveformZoomSync` / `useTranscriptionViewportFit` + WaveSurfer（播放与无 peaks 回退）。见 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)。

## 实现落位

- `utils/waveformNavigationMode.ts` — footer 文案
- `WaveformZoomBar.tsx` — 模式切换 UI
- `useTranscriptionLayer.ts` — 换文件 `resetZoom`
- `useWaveformEditorPrefs.ts` — 去掉换文件展开
- `WaveformGlobalPlaybackSpeed.tsx` — 全局变速
- `waveformPrefs.ts` — `globalPlaybackRate` 持久化
