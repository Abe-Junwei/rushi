# Research: Waveform Visual Clock Smoothing（视觉时钟平滑层）

> **状态**：调研门禁（本轮）
> **落位决策**：native 显示层 `nativeAudioPlaybackTransport.computeDisplayTime`（ADR-0008 授权的插值层），**不改** UI 视觉时钟
> **关联**：
> - [`waveform-playhead-single-clock-research.md`](./waveform-playhead-single-clock-research.md)（已采纳：禁 UI extrapolation、单时间源）
> - [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)（已采纳：rAF poll media，非 UI 外推）
> - [ADR-0008](../../adr/0008-native-audio-playback-transport.md) §时钟契约
> - 计划：`waveform-visual-clock-smoothing-plan.md`
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. Background & Root Cause Analysis

During timeline playback under low-zoom levels (20~40 px/s) or on high-DPI displays, the `edge` playback follow mode exhibits visible high-frequency playhead jitter (1-2px stuttering), whereas the `center` follow mode appears visual-continuous.

Previously this was suspected to be a sub-pixel quantization artifact within the scrolling/geometry layer. Cross-layer inspection disproves that: `edge` mid-band keeps `scrollLeft` (integer S) constant and the needle position `P_px(t) − S` is float-smooth by construction — so the residual jitter can only come from the **time source `t` itself**. The bottleneck is **temporal quantization in the rendering clock**, amplified by the physical characteristics of the `edge` tracking model:

* **Geometric attenuation in `center`:** the playhead is pinned at `vw/2`; the background timeline moves underneath. Any temporal freeze/lag is diluted across the whole waveform texture — the eye dampens the global stutter.
* **Geometric amplification in `edge`:** the background is fully stationary; a single 1px high-contrast needle sweeps a silent grid. The eye anchors on the needle, so a 10–30ms hold or leap becomes a glaring 0.5~2.5px micro-stutter / acceleration jump.

### Temporal artifact profiles

1. **Native engine (`nativeAudioPlaybackTransport`)** — the sole desktop playback path (ADR-0008 #3: `requireTransport` always true, WaveSurfer `play()` forbidden). On each `timeUpdate` re-anchor, `computeDisplayTime` freezes output when wall-clock extrapolation outpaces the latest authoritative latch (`if (next < lastDisplaySec) return lastDisplaySec`). Because `timeUpdate` delivery over IPC is jittery, the display line periodically drops below the running interpolation and **hard-freezes for `lead/rate` seconds** — cyclic multi-frame micro-plateaus.
2. **WaveSurfer engine (`resolveMediaPlaybackHost`)** — desktop does not use it for playback; documented only for completeness: raw `ws.getCurrentTime()` under WKWebView drops to an irregular ~13~17 Hz staircase.

---

## 2. Core Philosophy: Low-Pass Tracking Filter

Decouple the **Authoritative Media Clock (t_a)** from the **Visual Smooth Render Clock (t_v)** at the **native transport layer** — not via UI-side speculation.

A **first-order tracking filter** + **monotonic boundary clamp**, with these criteria:

1. `t_v` tracks `t_a` with zero steady-state error under linear velocity (proven: error `e[n] = (1−α)·e[n−1] → 0`).
2. `t_v` is strictly monotonic (`dt_v/dt ≥ 0`) under any authoritative deceleration/freeze — no visual regression/overshoot.
3. The smoothing coefficient is decoupled from the variable render frame rate (13~60 Hz observed).

### Mathematical model

Per evaluation, with `Δt` = real elapsed since last eval:

```
t_predict  = t_v_prev + Δt · r                     # inertial linear progression
α_eff      = 1 − exp(−Δt / τ)                        # FPS-decoupled convergence, τ ≈ 0.08~0.12s
t_filtered = t_predict + α_eff · (t_a − t_predict)   # first-order tracking toward authority
t_v        = max(t_v_prev, t_filtered)               # anti-rebound monotonic clamp
```

### Monotonicity failure & resolution

When `t_a` freezes while `t_v` has over-extrapolated past it, `(t_a − t_predict)` goes deeply negative and, unclamped, drives `Δt_v < 0` → a catastrophic "forward-then-backward" oscillation (exactly the observed jitter, just relocated). The `max(t_v_prev, …)` clamp intercepts: `t_v` degrades into a **flat plateau** (or a gentle deceleration when the lead is small) rather than snapping backward, then recaptures the trajectory once `t_a` moves ahead.

---

## 3. Structural Boundary & Compliance

### No UI extrapolation

```
[CPAL/Symphonia engine] --> Authoritative Latch (t_a: currentTimeSec)
          │
          ▼
[nativeAudioPlaybackTransport] --> computeDisplayTime(): low-pass + monotonic (t_v)
          │
          ▼
    getDisplayTime()          --> smooth monotonic display source
          │
          ▼
[useWaveformVisualPlayheadClock] --> UNCHANGED: stateless rAF poll of getDisplayTime()
          │
          ▼
[Ruler / Playhead / Center Follow] --> 100% unmodified downstream
```

The smoothing lives inside the **ADR-0008-sanctioned display interpolation layer** ("最后一次权威锚点 + performance.now() × rate；仅填事件间隙"). The UI clock stays a pure rAF poll (honors `waveform-visual-raf-playhead-research.md §4` "禁止 extrapolation"). No new time source; the authority/display dual clock **already exists** (`getCurrentTime` vs `getDisplayTime`) — we only improve the display arm. Downstream consumers change nothing.

---

## 4. Implementation Corrections（对 §2 抽象规约的落地校正，实现必须遵守）

抽象规约把 `t_a` 当作「每帧已知的当前权威时间」；native 侧的原始权威 latch (`currentTimeSec`) 在两次 `timeUpdate` 之间是**陈旧常量**。若直接把陈旧 latch 当参考，滤波器会收敛到常量 → 反而更硬地停顿。因此实现须做两点校正：

### C1. 参考量 = 权威投影 (authority-projected)，而非陈旧 latch

```
t_a = clamp(currentTimeSec + (now − lastEventAtMs) · rate, 0, duration)
```

这是「音频真实位置的连续直线」，只在 `timeUpdate` 重锚 `currentTimeSec` 时发生锯齿跳变；滤波器平滑掉的正是这条锯齿。`currentTimeSec`（权威 latch）保持精确，供 seek / 区间 / 导出。

### C2. seek/大跳变走事件重锚，不靠「向后 drift-yank」

规约 §5 的 `|t_predict − t_a| > MAX_DRIFT → t_v = t_a` 若对**向后**方向也生效，会在一次**较长的正常 stall**（lead 超过 50ms）时把 `t_v` 猛拉回权威 → 制造回弹。故：

- **向前**失配（`t_a − t_predict > MAX_DRIFT`，如 underrun/resume 落后）：允许瞬时前跳到 `t_a`（单调安全）。
- **向后**大跳变（真实 seek 回退）：**由 `seeked` 事件显式重锚** `t_v = t_a = target`，**不**在 `computeDisplayTime` 内做向后 snap。
- `Δt ≤ 0` 或 `Δt > 0.1s`（后台挂起/首帧）：重锚 `t_v = max(t_a, t_v_prev)`（前向安全，避免回退）。

### C3. 帧内多次读取幂等

`getDisplayTime()` 每帧被 follow/playhead/wash 多次调用。滤波器就地推进 `lastEvaluationTimeMs`：同帧首次调用按完整 `Δt` 前进，后续调用 `Δt≈0` → 返回同值。跨帧一致，无副作用。

---

## 5. State Transition & Reconcile Rules

| Trigger | Action | Target state |
|---|---|---|
| `ready` / `load` | 重锚 | `lastDisplaySec = currentTimeSec`；`lastEvaluationTimeMs = now` |
| `playing`（resume） | 从高水位恢复，禁回退 | `lastDisplaySec = max(currentTimeSec, lastDisplaySec)`；`lastEvaluationTimeMs = now` |
| `paused` | 冻结 | 冻结 `lastDisplaySec = computeDisplayTime()`；`playing=false` 后返回 `max(currentTimeSec, lastDisplaySec)` |
| `seeked` | 瞬时重锚（含向后） | `lastDisplaySec = currentTimeSec = target`；`lastEvaluationTimeMs = now` |
| `timeUpdate` | 仅更新权威 latch | `currentTimeSec = sec`；**不**重置 `lastDisplaySec` / `lastEvaluationTimeMs`（滤波器自然收敛） |
| `setRate` | 平滑换速 | 保留 `lastDisplaySec`；`lastEvaluationTimeMs = now`；新 `rate` 即时生效 |
| `ended` | 收尾 | `lastDisplaySec = currentTimeSec = duration` |

---

## 6. Verification & Acceptance

### Unit tests (`nativeAudioPlaybackTransport.test.ts`)

* **Stall**：`timeUpdate` 后冻结权威（不再发新事件），60fps 推进 100ms。断言 `getDisplayTime()` 每帧**单调不减**、平滑前推/减速，**从不低于任一历史帧**。
* **Step/Jump**：`seek(+1.5s)` → 断言同帧 `getDisplayTime()` 瞬时落到新目标，无拖尾/橡皮筋。
* **Frequency variance**：同一全局时间线分别以 15Hz / 60Hz 采样，断言 `getDisplayTime()` 误差曲线接近（τ 解耦帧率）。
* **回归保护**：现有契约不回退 — 播放中前进（>base）、pause 冻结在高水位、resume 不回退、rate 变更不把插值喂回权威、seek 不由普通 timeUpdate 解析。

### Manual

* 低 zoom（20–40px/s）`edge`：静止轨道上针连续下行，无 sub-pixel 微步（Retina / 非 Retina 一致）。
* 层间一致：针与 peaks / ruler 刻度对齐，无缝隙/漂移。

---

## 7. 落位预告 + 不做什么

| 层 | 文件 | 变更 |
|----|------|------|
| transport | `apps/desktop/src/services/waveform/transport/nativeAudioPlaybackTransport.ts` | `computeDisplayTime` 改为临界阻尼平滑（C1–C3）；事件重锚按 §5 |
| test | `.../nativeAudioPlaybackTransport.test.ts` | 新增 stall/step/frequency；保留现有契约 |
| ADR | `docs/adr/0008-native-audio-playback-transport.md` | 时钟契约「显示」行补注：临界阻尼平滑 + 单调钳制 |
| arch | `docs/architecture/desktop-waveform-engine.md` | 显示钟为平滑源；`edge` 针平滑根因说明 |

**不做**：❌ 不在 UI 视觉时钟做 extrapolation；❌ 不新增第三套时钟；❌ 不改权威 latch / seek 命令用时；❌ 不改任何消费端 API；❌ 不动 WaveSurfer 路径（桌面不用于播放）。

---

## 8. 签收

- [x] 调研 brief 完成（根因 + 业内低通跟踪对照 + 落位校正）
- [ ] plan / acceptance 已链接
- [ ] 用户确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-14 | 初版：native 显示层临界阻尼平滑；单调钳制；τ 解耦帧率；C1 权威投影参考 / C2 事件重锚 校正 |
