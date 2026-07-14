# Plan: Waveform Visual Clock Smoothing

> **Research（顶部链接）**：[`waveform-visual-clock-smoothing-research.md`](./waveform-visual-clock-smoothing-research.md)
> **关联 ADR**：[ADR-0008](../../adr/0008-native-audio-playback-transport.md) §时钟契约
> **落位**：native 显示层，消费端零改动

## 1. 目标

消除 `edge` 跟随模式下播放头可见抖动（1–2px），根因为 native `computeDisplayTime` 在 `timeUpdate` 重锚滞后权威时的**高水位硬冻结**。改为临界阻尼低通跟踪 + 单调钳制，使显示钟连续平滑且单调，`center`/`edge`/ruler 全部消费端零改动即受益。

## 2. 契约不变量（实现必须保持）

- **INV-1 单调**：播放中 `getDisplayTime()` 逐帧不减。
- **INV-2 权威精确**：`getCurrentTime()`（authority latch）不受平滑影响；seek/区间/导出用它。
- **INV-3 收敛无稳态偏差**：线性速率下 `t_v → t_a`（误差指数衰减）。
- **INV-4 帧率解耦**：`α_eff = 1 − exp(−Δt/τ)`，15–60fps 手感一致。
- **INV-5 无 UI 外推**：`useWaveformVisualPlayheadClock` 保持 rAF poll 原样。
- **INV-6 seek 瞬时**：`seeked` 事件重锚 `t_v = target`，无拖尾/回弹。

## 3. 落位文件

| # | 文件 | 变更 |
|---|------|------|
| P1 | `apps/desktop/src/services/waveform/transport/nativeAudioPlaybackTransport.ts` | 新纯函数 `computeSmoothDisplayStep`（可测）；`computeDisplayTime` 调用它；`anchorTime`/事件按 research §5 重锚；新增 `lastEvaluationTimeMs` 状态 |
| P2 | `.../nativeAudioPlaybackTransport.test.ts` | 新增 stall / step / frequency-variance；保留现有 6 项契约 |
| P3 | `docs/adr/0008-native-audio-playback-transport.md` | 时钟契约「显示」行补注平滑 + 单调 |
| P4 | `docs/architecture/desktop-waveform-engine.md` | 显示钟平滑源；edge 针根因 |

## 4. 纯函数签名（便于单测）

```ts
type SmoothDisplayStep = {
  tvPrev: number;        // 上帧显示值
  taProjected: number;   // 权威投影 = currentTimeSec + (now-lastEventAtMs)*rate（已 clamp duration）
  deltaSec: number;      // (now - lastEvaluationTimeMs)/1000
  rate: number;
  tau?: number;          // 默认 0.10
  maxDriftSec?: number;  // 默认 0.05
};
// 返回下一帧显示值（单调、平滑、前向大失配瞬跳）
function computeSmoothDisplayStep(s: SmoothDisplayStep): number;
```

规则（对应 research §2 + §4 C1–C3）：
1. `deltaSec ≤ 0 || deltaSec > 0.1` → `max(taProjected, tvPrev)`（前向安全重锚）。
2. `tPredict = tvPrev + deltaSec*rate`。
3. 前向失配 `taProjected - tPredict > maxDrift` → `max(tvPrev, taProjected)`（追赶）。
4. 否则 `α = 1 - exp(-deltaSec/tau)`；`tFiltered = tPredict + α*(taProjected - tPredict)`；返回 `max(tvPrev, tFiltered)`。

> 向后大跳变（真实 seek）不在此函数处理 —— 由 `seeked` 事件重锚。

## 5. 验证

```bash
npm run typecheck
npm run test -- nativeAudioPlaybackTransport
npm run lint
node scripts/check-architecture-guard.mjs
```

手测：低 zoom edge 播放，针连续无微步；seek 无回弹；pause 冻结不回退。

## 6. 验收矩阵

| 场景 | 期望 | 覆盖 |
|------|------|------|
| 权威冻结 100ms@60fps | t_v 单调平滑，不停死、不回退 | stall unit |
| seek +1.5s | 同帧瞬时同步，无拖尾 | step unit + seeked reset |
| 15Hz vs 60Hz | 输出误差曲线接近 | frequency unit |
| pause | 冻结高水位不回退 | 现有契约 |
| resume | 不回退 | 现有契约 |
| rate 变更 | 不喂回权威、仍单调 | 现有契约 |
