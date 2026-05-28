# Acceptance: waveform_engine_refactor

## P1 完成定义

- [x] 导入/打开含音频文件后，`ensure_waveform_peaks` 生成或复用 L0/L1/L2 `.dat`
- [x] 前端 `PeakCache` 可加载 `.dat` 并按 `pxPerSec` resample
- [x] `useProjectWaveform` 在 peaks 可用时使用预计算 peaks
- [x] `pxPerSec === renderPxPerSec`；Editor 无 CSS `scaleX` 水平预览
- [x] `WaveformEngine` / `WaveformViewport` 骨架 + 单元测试
- [x] 删除 audio file 时清理对应 peaks 文件

## P2 完成定义

- [x] 缩放时 `PeakCache.resample()` + `ws.load(peaks)`，有 peaks 时不走 `ws.zoom()`
- [x] 滑块拖动 rAF 合并 resample 请求
- [x] `PeakCache` 按 px/s  memo resample 结果

## P3 完成定义（增量）

- [x] `WaveformPeaksCanvas` 仅绘制可见视口（peaks 路径）
- [x] WaveSurfer 波形层透明，保留 Regions / 播放 / seek 交互
- [ ] 完全移除 WaveSurfer 波形绘制（P3 终态，待 P4 语段 overlay 后）

## P4 / P5（未开始）

- [ ] DOM overlay 语段，移除 WS Regions
- [ ] Overview / Zoom 双视图（可选）

## 机器验证

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过（含 `PeakCache` / `useWaveformZoom` / `waveformPeaks`）
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error
- [ ] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml waveform_peaks` 通过

## 手测场景

### 短音频（< 2min）

1. 新建项目导入 MP3 → 打开编辑器 → 波形可见，播放/seek 正常。
2. 缩放滑块连续拖动 → 波形即时更新，无「拉伸预览」感。
3. 「适配整段时长」→ 全文件一屏；「适配选中语段」→ 选中段居中。

### 长音频（> 30min，若有 fixture）

1. 打开后 5s 内应看到波形轮廓（peaks），不必等 decode 进度条式卡顿。
2. fit 全段 → px/s 低于手动滑块下限仍可工作。

### 回归

1. 语段边界拖拽 → undo/redo 正常。
2. 波形空白拖选新建语段 → 仍可用。
3. 无 peaks（生成失败模拟：删 peaks 目录）→ 仍回退 WS decode，不白屏。

## 性能基线（P0 记录）

| 指标 | 改前（估） | P1 目标 |
|------|-----------|---------|
| 10min MP3 peaks 生成 | N/A | < 3s |
| 缩放滑块 commit → 重绘 | 100–300ms+ | < 50ms（peaks 路径） |
| React re-render / scroll | 已节流 | 保持 |

## 已知限制（P1）

- 仍使用 WaveSurfer `zoom()` + Regions；P3/P4 继续迁移。
- 无 overview 折叠条（P5）。
- peaks 仅 mono mixdown；立体声取通道混合。
