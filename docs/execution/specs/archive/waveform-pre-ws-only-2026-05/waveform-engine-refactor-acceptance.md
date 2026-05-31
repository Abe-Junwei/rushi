# Acceptance: waveform_engine_refactor

## P1 完成定义

- [x] 导入/打开含音频文件后，`ensure_waveform_peaks` 生成或复用 L0/L1/L2 `.dat`
- [x] 前端 `PeakCache` 可加载 `.dat` 并按 `pxPerSec` resample
- [x] `useProjectWaveform` 在 peaks 可用时使用预计算 peaks
- [x] `pxPerSec === renderPxPerSec`；Editor 无 CSS `scaleX` 水平预览
- [x] ~~`WaveformEngine` / `WaveformViewport` 骨架~~ → **已删除**（2026-05-28）；真源见 `desktop-waveform-engine.md`
- [x] 删除 audio file 时清理对应 peaks 文件

## P2 完成定义

- [x] 缩放时 `PeakCache.resample()` + `ws.load(peaks)`；**peaks 路径 skip `ws.zoom()`**
- [x] 滑块拖动 rAF 合并 resample 请求
- [x] `PeakCache` 按 px/s memo resample 结果

## P3 完成定义

- [x] `WaveformPeaksCanvas` / `WaveformPeaksViewportLayer` 仅绘制 tier 可见视口
- [x] WaveSurfer 波形层透明，保留播放 / seek（语段由 DOM overlay）
- [x] peaks 路径下可见波形由 Canvas 承担

## P4 完成定义

- [x] DOM overlay 语段，移除 WS Regions

## P5′ 完成定义（全局导航 UX，替代原双视图）

- [x] 单一主波形区（用户可调高度）；无总览/精修 Tab
- [x] 底部全局波形条可折叠/展开；**换 `mediaUrl` 重置为展开**
- [x] 默认选中语段：seek + 滚动居中，不改变 px/s
- [x] 底部准星开关：开启时选中语段才 `zoomToFitSelection`（持久化）
- [x] 全局条：视口窗、拖拽平移、点击 seek、语段 chip、peaks 缩略
- [x] 规格：`waveform-engine-refactor-p5-global-strip.md`

## P6（登记，非本轮回）

- [x] `useWaveformSegmentOverlay` 拆分 — 见 `waveform-engine-refactor-p6-overlay-split.md`

## 机器验证

- [x] `npm run typecheck` 通过
- [x] `npm run test` 通过
- [x] `node scripts/check-architecture-guard.mjs` 无 error（overlay hotspot 为 P6）
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml waveform_peaks` 通过

## 能力—UI 状态矩阵（缩放工具栏）

依据 [`docs/architecture/desktop-capability-ui-state-alignment.md`](../../../../architecture/desktop-capability-ui-state-alignment.md)。

| 维度 | 真源 | UI 控件 | 对齐规则 |
|------|------|---------|----------|
| **Z1 当前 px/s** | `pxPerSec` | 百分比、`px/s` 标签、滑块 | 标签始终反映真实 px/s；跟随长语段导致 px/s &lt; 16 时滑块 **禁用** 且 `aria-valuetext` 说明，不假装在 16px/s |
| **Z2 导航模式** | `autoFitSelectionToViewport`（持久化） | 分段：手动 / 跟随语段 | ON → footer「跟随语段」；OFF →「手动缩放」 |
| **Z3 视图模式** | `deriveWaveformZoomViewMode` | （无模式按钮） | 派生：`fit-selection` \| `default` \| `custom`；全文件导航见 **全局条** |
| **Z4 手动边界** | `PX_PER_SEC_MIN/MAX` | +/- | 达 min/max 时 disabled + tooltip |
| **Z5 选中语段** | `selectedIdx` + segment bounds | 跟随模式下换段 | 跟随 ON → `resolveSelectionFitPxPerSec`（能放下只滚） |

互斥与动作：

- 选 **跟随语段**：Z2=ON；换语段触发 fit/scroll
- 选 **手动**：Z2=OFF；取消进行中的 viewport fit
- 换文件：px/s 重置 100%（`resetZoom`）

## 手测场景

见 `waveform-engine-refactor-hand-test.md`。

### 短音频（< 2min）

1. 打开编辑器 → 主波形可见，播放/seek 正常。
2. 缩放滑块连续拖动 → 无 scaleX 拉伸感。
3. 手动 → 选语段 px/s 不变；跟随语段 → 选语段 fit 视口。
4. 全局条 → 全文件 minimap 导航（拖视口框 / seek）。

### 长音频（> 30min，若有 fixture）

1. 打开后尽快看到 peaks 轮廓。
2. fit 全段 → px/s 可低于手动滑块下限。

### 回归

1. 语段边界拖拽 → undo/redo。
2. 波形空白拖选新建语段。
3. 删 peaks 目录 → WS decode 回退，不白屏。
4. 折叠全局条 → 换文件 → 自动展开。

## 已知限制

- WaveSurfer 负责播放 backend 与无 peaks 回退 decode。
- 波形编排以 hook + `PeakCache` 为真源（无独立 Engine facade）。
- peaks 仅 mono mixdown。
- overlay hook 超阈值 → P6。

## 架构真源

- [`docs/architecture/desktop-waveform-engine.md`](../../../../architecture/desktop-waveform-engine.md)
