# Hand test: waveform_engine_refactor (P0–P3)

机器闸门：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml waveform_peaks
```

## P2 新增手测

| # | 操作 | 预期 |
|---|------|------|
| 1 | 打开含 peaks 的音频，拖动缩放滑块 | 波形更新流畅；DevTools 中 peaks 路径下 **`ws.zoom` 不应频繁调用**（改由 resample + load） |
| 2 | 同一 px/s 反复 fit 全段 / 重置 | 第二次无明显 resample 卡顿（memo 命中） |

## P3 新增手测

| # | 操作 | 预期 |
|---|------|------|
| 1 | peaks 就绪后观察波形 | 可见波形由 **Canvas 层**绘制（WS 波形 SVG/canvas 为透明） |
| 2 | 播放 / seek / 语段 Regions 拖拽 | 与 P1 行为一致 |
| 3 | 删 `peaks/` 目录后重开 | 回退 WS 自带波形（非透明），不白屏 |

## P0 性能记录（可选）

| 指标 | 记录 |
|------|------|
| 10min MP3 peaks 生成 | ___ s |
| 滑块连续拖动主观 | 流畅 / 卡 / 有拉伸 |
| 打开到波形可见 | ___ s |

## 回归（P1 清单仍适用）

短音频：打开 → 播放 → fit 全段 / fit 选中 → 语段边界 undo → 空白拖选新建语段。
