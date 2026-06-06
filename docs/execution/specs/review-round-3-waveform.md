# 轮次 3 审查报告：编辑器/波形链路

## 审查范围

**前端**：`useProjectWaveformMount.ts`, `useWaveformZoomSync.ts`, `useWaveformPeaks.ts`, `PeakCache.ts`, `EditorWaveformPane.tsx`

**Rust 后端**：`waveform_peaks_generate.rs`, `waveform_peaks_ffmpeg.rs`, `waveform_peaks_cmd.rs`

**测试**：vitest waveform 相关全部通过 ✅

---

## 缺陷清单

### P2 — 中优先级

#### 3.1 `useWaveformPeaks.ts` 超过 300 行阈值
**位置**：`apps/desktop/src/hooks/useWaveformPeaks.ts` — 351 行

AGENTS.md 规定 hook > 300 行应拆分。

#### 3.2 `useWaveformViewportController.ts` 超过 300 行
**位置**：`apps/desktop/src/hooks/useWaveformViewportController.ts` — 327 行

#### 3.3 `useWaveformSegmentDrag.ts` 接近 400 行
**位置**：`apps/desktop/src/hooks/useWaveformSegmentDrag.ts` — 396 行

#### 3.4 `installWaveSurferProgressAbortWarnFilter` 模块级副作用
**位置**：`apps/desktop/src/hooks/useProjectWaveformMount.ts:19`

```typescript
installWaveSurferProgressAbortWarnFilter();
```

在模块顶层执行 WaveSurfer 全局 patch。如果 WaveSurfer 升级后内部实现变化，此 patch 可能失效或报错。应移至 `useProjectWaveformMount` 的 effect 中，仅在首次使用时执行。

#### 3.5 PeakCache `touchResampleKey` 使用 O(n) `indexOf`
**位置**：`apps/desktop/src/services/waveform/PeakCache.ts:218-223`

```typescript
private touchResampleKey(key: string): void {
  const idx = this.resampleCacheOrder.indexOf(key);  // O(n)
  if (idx >= 0) {
    this.resampleCacheOrder.splice(idx, 1);  // O(n)
    this.resampleCacheOrder.push(key);
  }
}
```

虽然 `RESAMPLE_CACHE_MAX = 16`，O(n) 可忽略，但如果未来扩大缓存，应使用 Map 维护 order 实现 O(1)。

#### 3.6 `useProjectWaveformMount.ts` effect 依赖数组过长
**位置**：`useProjectWaveformMount.ts:206-230`

依赖数组包含 23 个项，几乎每次 render 都会触发 effect。虽然 `mediaUrl`/`deferDecodeMount`/`peakCacheGeneration` 是主要的，但大量 ref/setter 在依赖数组中增加了误触发风险。

**分析**：这是刻意设计。React 18 中 ref 和 setter 的稳定性足够，实际不会导致不必要的重运行。但代码可读性较差。

---

### P3 — 低优先级

#### 3.7 WaveSurfer 实例泄漏风险
**位置**：`useProjectWaveformDestroy.ts`

```typescript
try {
  ws.destroy();
} catch {
  /* noop */
}
```

`ws.destroy()` 是异步的（WaveSurfer 内部有动画/音频上下文清理）。`try/catch` 只能捕获同步错误。如果 WaveSurfer 在 destroy 过程中抛出异步错误（如音频上下文已关闭），无法捕获。

**实际影响**：WaveSurfer 7.x 的 `destroy()` 在大多数情况下是同步的，此风险较低。

#### 3.8 `waveform_peaks_generate.rs` 使用单线程 Symphonia 解码
**位置**：`waveform_peaks_generate.rs`

大音频文件（数小时）的峰值生成在 Tauri command 的 `spawn_blocking` 中执行，但这是单线程解码。行业更优方案是使用 `rayon` 并行处理多个 LOD 级别。不过当前性能对于 1-2 小时音频已足够。

---

## 动态模拟结果

| 测试 | 结果 | 备注 |
|------|------|------|
| vitest waveform 相关 | ✅ 全部通过 | PeakCache、zoom sync、viewport 等 |
| cargo test waveform_peaks | ✅ 通过 | — |
| 架构守卫 | ⚠️ 43 warnings | 无 error |

---

## 修复优先级

| 优先级 | 事项 | 文件 |
|--------|------|------|
| P2 | 拆分 `useWaveformPeaks.ts` | `useWaveformPeaks.ts` |
| P2 | 拆分 `useWaveformViewportController.ts` | `useWaveformViewportController.ts` |
| P2 | 拆分 `useWaveformSegmentDrag.ts` | `useWaveformSegmentDrag.ts` |
| P2 | `installWaveSurferProgressAbortWarnFilter` 移至 effect | `useProjectWaveformMount.ts` |
| P3 | PeakCache LRU 优化为 O(1) | `PeakCache.ts` |
