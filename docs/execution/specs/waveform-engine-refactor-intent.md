# Intent: waveform_engine_refactor

## 目标

将桌面端波形从「WaveSurfer 全量 decode + 双轨 px/s + CSS scaleX 预览 + 双 scroll 同步」迁移到 **BBC audiowaveform 式预计算 peaks + 单一 px/s + imperative WaveformEngine**，消除缩放/渲染卡顿，并缩短长音频首屏时间。

## 为什么现在做

1. 近期已修复 fit-all / fit-selection，但根因仍在：`ws.zoom()` 全 canvas 重绘、浏览器 decode 全文件、visual/render 双轨 px/s。
2. WaveSurfer 官方 FAQ 与 BBC Peaks.js 均推荐 **导入时预计算 peaks + 播放与绘制解耦**；Rushi 已有 Tauri 项目 bundle，比纯 Web 更易落地。
3. 当前 `useProjectWaveform` + `useWaveformZoom` + tier scroll sync 已接近复杂度阈值，继续 patch 收益递减。

## 用户任务

1. 导入/打开含音频的项目后，波形应在 peaks 就绪后 **尽快可见**（不必等全文件 decode）。
2. 缩放滑块、fit 全段/选中语段、播放头与语段 overlay 应保持流畅，无明显掉帧。
3. 语段边界拖拽、split/merge、播放控制等行为与现版一致。

## 目标内范围（分阶段）

### P0 — 基线

- 记录当前 zoom / scroll / 首屏耗时对比口径（Vitest micro-benchmark + 手测 checklist）。

### P1 — Peaks 管线 + 单一 px/s（本轮）

- Tauri：`ensure_waveform_peaks` 在导入目录生成 L0/L1/L2 `.dat`（audiowaveform v1 二进制）。
- 前端：`PeakCache` + `waveform-data` 解析；WaveSurfer 使用预计算 peaks + `MediaElement` 播放。
- 移除 visual/render 双轨 px/s 与 CSS `scaleX` 水平预览。
- `WaveformEngine` / `WaveformViewport` 骨架（订阅 API，暂与 WS 并存）。

### P2 — 多级 LOD resample

- 缩放时 `waveform-data.resample()` 换档，减少 `ws.zoom()` 频率（向自定义 Canvas 过渡）。

### P3 — 自研 Canvas 渲染

- 弃用 WS 波形绘制，保留或替换播放 backend。

### P4 — DOM overlay 语段

- 移除 WS Regions，语段/time ruler 对齐单一 scroll container。

### P5 — Overview / Zoom 双视图（可选）

- 语段列表编辑时低分辨率 overview；精细改 in/out 时全宽 zoom view。

## 明确不做（本轮）

- 不引入 Peaks.js 整包 UI（仅复用 `waveform-data` 数据层）。
- 不改语段 SQLite schema / 导出格式。
- 不做 sample 级 L3 peaks（留 P2+）。
- 不改动 ASR / 环境 Setup 能力矩阵。

## 边界决策

```text
导入音频 (Tauri)
  → symphonia decode 流式 min/max
  → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

打开编辑器 (React)
  → invoke ensure_waveform_peaks
  → fetch(convertFileSrc(dat)) + WaveformData
  → PeakCache.resample(pxPerSec)
  → WaveSurfer(peaks + MediaElement url)  // P1
  → WaveformEngine.draw(viewport)         // P3
```

## 成功标准

- 10min MP3：peaks 生成 < 3s（本机 M 系列参考）；首屏波形可见早于全量 decode 完成。
- 缩放滑块连续拖动：无 CSS scaleX；`pxPerSec === renderPxPerSec`。
- `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过。
- 手测：fit 全段、fit 选中语段、语段边界拖拽、播放/seek 回归通过。

## 依赖与前置

- 现有 `useProjectWaveform` / `EditorWaveformPane` / tier scroll 架构。
- 新增 Rust 依赖 `symphonia`；前端依赖 `waveform-data`。
