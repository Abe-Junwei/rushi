# P5′：全局波形导航（替代原双视图）

> **2026-05 产品变更**：已移除「总览 / 精修」Tab。原 `waveform-engine-refactor-p5-dual-view.md` 描述的双模式 **废弃**。

## 当前 UX

| 区域 | 行为 |
|------|------|
| **主波形** | 用户可调高度；DOM overlay 语段；Canvas peaks 绘制 |
| **底部全局条** | 整段 minimap；可 **折叠/展开**；折叠状态 **持久化** |
| **选中语段** | 默认 seek + 滚动居中；**不**改变 px/s（手动模式） |
| **跟随语段** | 开启后选中语段才 fit（能放下只滚）；偏好持久化 |
| **换文件** | 横向缩放重置 100%；全局条折叠状态仍记住 |

## 代码落位

- `utils/waveformViewMode.ts` — 全局条高度常量
- `utils/waveformPrefs.ts` — `autoFitSelectionToViewport` / `globalStripCollapsed`
- `hooks/useWaveformEditorPrefs.ts` — 偏好 state + `globalStripCollapsed` 持久化
- `components/WaveformGlobalStripShell.tsx` — 折叠 UI
- `components/WaveformOverviewStrip.tsx` — minimap 内容
- `components/WaveformPeaksViewportLayer.tsx` — 主 tier 固定 peaks
- `pages/useTranscriptionLayer.ts` — `selectSegmentAt` 编排

## 验证

手测见 `waveform-engine-refactor-hand-test.md` §P5′。
