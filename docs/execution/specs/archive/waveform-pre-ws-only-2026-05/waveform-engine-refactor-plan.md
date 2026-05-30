# Spec: waveform_engine_refactor

## 目标

按业内 BBC audiowaveform + Audacity LOD 路线，分阶段替换 WaveSurfer 重绘路径；**本轮（P0+P1）** 交付 peaks 预计算、PeakCache、单一 px/s、WaveformEngine 骨架。

## 受影响代码地图

| 路径 | 职责 |
|------|------|
| `apps/desktop/src-tauri/src/project/waveform_peaks.rs` | symphonia 解码 + audiowaveform `.dat` 写入 |
| `apps/desktop/src-tauri/src/project/waveform_peaks_cmd.rs` | `ensure_waveform_peaks` / `waveform_peaks_status` |
| `apps/desktop/src-tauri/src/project/file_cmd.rs` | 删除文件时清理 peaks |
| `apps/desktop/src/services/waveform/*` | PeakCache、WaveformEngine、WaveformViewport |
| `apps/desktop/src/tauri/waveformPeaksApi.ts` | invoke 封装 |
| `apps/desktop/src/hooks/useWaveformPeaks.ts` | 打开文件时 ensure + 加载 |
| `apps/desktop/src/hooks/useWaveformZoom.ts` | 单一 px/s，移除 deferred preview |
| `apps/desktop/src/hooks/useProjectWaveform.ts` | peaks + MediaElement |
| `apps/desktop/src/components/editor/EditorWaveformPane.tsx` | 主波形 + 全局条组装 |
| `apps/desktop/src/pages/transcriptionLayerTypes.ts` | 传入 projectId / fileId |

## Peaks 文件布局

```text
{app_data}/projects/{project_id}/peaks/{file_id}_L0.dat  # 2 px/s
{app_data}/projects/{project_id}/peaks/{file_id}_L1.dat  # 20 px/s
{app_data}/projects/{project_id}/peaks/{file_id}_L2.dat  # 200 px/s
```

二进制格式：audiowaveform v1（`waveform-data` 可直接 `WaveformData.create`）。

## 前后端契约

```ts
export interface WaveformPeaksStatus {
  levels: Array<{
    level: number;
    pixelsPerSecond: number;
    path: string;
    exists: boolean;
  }>;
  sampleRate: number | null;
  durationSec: number | null;
}

ensureWaveformPeaks(projectId: string, fileId: string): Promise<WaveformPeaksStatus>
waveformPeaksStatus(projectId: string, fileId: string): Promise<WaveformPeaksStatus>
```

```rust
#[tauri::command]
pub fn ensure_waveform_peaks(state: State<DbState>, project_id: String, file_id: String)
    -> Result<WaveformPeaksStatus, String>
```

## 拆分方案

1. `waveform_peaks.rs` — 纯 Rust peaks 生成（无 Tauri）。
2. `PeakCache.ts` — LOD 选择与 `resample`；`WaveformEngine.ts` — 订阅 facade。
3. `useWaveformPeaks.ts` — React 边界：只在 project/file 切换时加载。
4. `useWaveformZoom.ts` — 简化为 `useState` + localStorage，删除 `useDeferredRendererState`。

## 约束

- peaks 生成失败 **不阻塞** 打开编辑器（回退 WS decode 路径）。
- 不新增 Tailwind arbitrary hex；波形颜色仍用 `tokens.ts`。
- 单文件 hook ≤ 300 行；新增 Rust 模块 > 500 行须拆子模块。
- P1 保留 WS Regions；P4 再移除。

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml waveform_peaks
```

## 能力—UI 状态矩阵

本任务为编辑器波形渲染重构，**不涉及** ASR/环境 Setup 能力矩阵；无 D1–D5 控件变更。
