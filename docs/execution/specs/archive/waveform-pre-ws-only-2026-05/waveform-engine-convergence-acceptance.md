# Acceptance: waveform_engine_convergence

> Intent：[`waveform-engine-convergence-intent.md`](./waveform-engine-convergence-intent.md)

## 能力—UI 状态矩阵

| 能力状态 | UI 状态 | 用户可见 |
|----------|---------|----------|
| 无 peaks、无 cache | loading | 主区+总览 loading |
| generating（uncached） | loading（文案区分） | 「正在生成波形…」；**不**假 ready；**不**新增 `generating` 枚举 |
| peaks 就绪（L0+L1+L2 一次 pass） | ready | 完整波形；无全屏遮罩 |
| ensure 失败 | error | 错误条 |
| peaksCanvasActive | ready | canvas 绘制；WS 透明（`peakCache && !error`） |
| peaksTimelineActive | — | scroll follow；可含 loading（与 canvas 语义分离） |
| 清 peaks 重算 | loading（无 cache）或 ready（旧 cache 直至 reload） | 与 `resolveWaveformPeaksUiState` 一致 |

**删除的矩阵行**（L0 可见性证伪）：~~仅 L0 就绪~~、~~L1/L2 后台渐进精细~~。

## Benchmark 证据（PR2 前填写）

| 环境 | 样本 | L2→targetWidth median | L2→targetWidth p95 | 日期 |
|------|------|----------------------|-------------------|------|
| _待填：macOS WKWebView / Node 版本_ | 4h @200pps base | _ms_ | _ms_ | _YYYY-MM-DD_ |

> 须使用 **`waveform-data` 真库** `WaveformData.resample({ width })`，禁止手写算法模拟代替。  
> **H4-C03 以 WebView 列为准**；Node 列仅作 CI 回归。

### Rust 冷生成（H4-U03，一次手测）

| 样本 | `generate_all_levels`  wall time | 机器 | 日期 |
|------|----------------------------------|------|------|
| _待填：4h 音频 fileId_ | _s_ | _CPU_ | _YYYY-MM-DD_ |

## 手测清单

### 19min（PR1 起每轮）

- [ ] 主区 peaks 铺满，无左密右空
- [ ] 标尺 sticky；语段与 peaks 对齐
- [ ] zoom 拖动：layout 跟手，拖动中 draw 不 storm
- [ ] pointerup 后波形与 layout 对齐
- [ ] 顶栏「清除 peaks」→ 重算完整
- [ ] peaks 就绪时 DevTools：WS 无 injected peaks 波形（transparent）

### 4h cached（PR2+）

- [ ] 冷打开 ≤3s：总览 + 主区有波形
- [ ] 横滚 5s 无明显卡死
- [ ] zoom ~58px/s：可见区 ≤300ms（对照 benchmark p95）
- [ ] 拖拽建段跟手

### 4h uncached（PR1+，诚实语义）

- [ ] ≤500ms 出现 generating
- [ ] **不** fail 于「3s 内完整全轨」或「部分 L0 可见」
- [ ] 填写 Rust 生成时间表（上节）
- [ ] 生成完成后二次打开满足 cached 清单

## 机器验证

每 PR merge 前：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

### PR0

- [ ] typecheck 绿（`revision` / `columnSpace` 债已清）

### PR1

- [ ] WS mount：`peaksCanvasActive` 时 create options **无** `peaks`
- [ ] `computeTimelineWidthPx(短时长, 低 px/s)` 无默认 320 floor
- [ ] **落地** `drawPxPerSec` / `layoutPxPerSec` 双轨（现网仍为单一 `pxPerSec`）
- [ ] zoom 拖动中 `contentKey` 不随 layout px/s 每帧变化
- [ ] mismatch force ensure **至多一次** per `project|file|duration`（第二 effect 无 `status` 依赖）
- [ ] 对外无 `getWaveSurferPeaks` 调用（或已删）

### PR2

- [ ] spy：`WaveformPeaksTile` 不调用 `getInterleavedPeaks`
- [ ] spy：同一 `drawPxPerSec` Layer 侧 resample 调用 ≤1（cache miss 场景）
- [ ] benchmark 证据表已填

### PR3（若做 Worker）

- [ ] 主线程 Transfer `ArrayBuffer`；Worker 内无 `fetch(asset.localhost)` 硬依赖
- [ ] cancel / generation 变更后 stale 结果不绘制（mock）

## 完成定义

- PR0–PR2 落地 + 19min + 4h cached 手测通过
- uncached 按 H4-U*（无渐进 L0 承诺）
- PR3 Worker：**仅**在 benchmark/spike 超预算时必做；否则可 skip
- PR4 更新 `desktop-waveform-engine.md`；清理 `waveformScrollSync` decode-bridge 死代码（若 compat 未启用）
