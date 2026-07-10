# Plan：WS-2b 视口窗口绘制（Peaks 模型 · Rushi canvas）

> **调研**：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)  
> **acceptance**：[`waveform-ws2b-viewport-render-acceptance.md`](./waveform-ws2b-viewport-render-acceptance.md)  
> **前序**：[`waveform-ws-canvas-fps-plan.md`](./waveform-ws-canvas-fps-plan.md)（WS-1/WS-2a FAIL → 本轨）  
> **architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)  
> **状态**：spike v4 **PASS** · Plan 定稿 · **生产化编码完成** · S1/S5/S6 手测 PASS · 待 S3/S4

---

## 0. 目标与闸门

| 项 | 内容 |
|----|------|
| 用户目标 | 深 zoom 播放 playhead / 视口波形稳态 ≥45 fps |
| Spike 证据 | v4：`playbackFrames` 稳态 ~47–52，峰值 54；`scrollW=1`；WS timer silenced |
| 生产目标 | 去掉 `WAVEFORM_WS2B_VIEWPORT_CANVAS_SPIKE` 试验态，固化「可见波形 = Rushi viewport canvas；WS = media transport」 |
| 成功标准 | 见 acceptance S1–S6 |

---

## 1. 终态架构（与 spike 对齐）

```text
tier.scrollLeft (权威)
  → PeakCache @ drawPxPerSec
  → WaveformViewportPeaksCanvas（视口 + overscan，dirty 重绘）
  → DOM playhead（VRP rAF 轮询 media.currentTime）
WaveSurfer: media only（play/pause/seek/getCurrentTime）
  · stub peaks + minPxPerSec=0 + fillParent
  · 无 zoom/peaks 回灌、无内部 timer/progress 热路径
  · host 1×1 + opacity:0（保留 media，去掉合成面）
```

**不变量（保持）**

- 单一 `PeakCache` / 单一 tier scroll 真源
- 本仓 `useWaveformVisualPlayheadClock` 为播放视觉时钟
- 不迁移 Peaks.js / 不 fork WaveSurfer / 不恢复巨宽 host

---

## 2. 生产化切片（建议 1 个 PR 主题）

### 2A — 固化 media-only WS（必做）

| 落位 | 动作 |
|------|------|
| `collapseWaveSurferToMediaOnlySpike.ts` | 去 spike 命名 → `collapseWaveSurferToMediaOnly`（或等价）；默认路径调用 |
| `silenceWaveSurferRendererClockForSpike.ts` | 去 spike 命名 → `silenceWaveSurferRendererClock`；ready 后默认调用 |
| `useProjectWaveformMount.ts` | 默认 stub peaks + `minPxPerSec=0` + `fillParent`；**不**装 tier-scroll / played-region 补丁 |
| `useProjectWaveform.ts` / zoom sync | 默认禁用向 WS 的 `ws.zoom` / `ws.load(peaks)`（layout/draw 仍驱动 Rushi canvas） |
| `EditorWaveformPeaksStage.tsx` | WS host ready 后 1×1 + opacity:0 为默认（非 flag） |
| `waveformPrefs.ts` | 移除或默认永久 `true` 后删除 `WAVEFORM_WS2B_VIEWPORT_CANVAS_SPIKE` |

### 2B — 视口 peaks canvas 硬化（必做）

| 落位 | 动作 |
|------|------|
| `WaveformViewportPeaksCanvas.tsx` | 保留 scroll dirty + 不订阅 playhead；补 zoom/`drawPxPerSec` 切换强制重绘 |
| `drawWaveformViewportPeaks.ts` | 保持纯函数；可选补 played tint 双 pass（见 2C） |
| 测试 | 窗口 / dirty / collapse / silence / stage 接线 |

### 2C — 已播放着色（可同 PR 或紧随薄片）

Spike 为过 fps **关掉了** played tint。生产需恢复语义之一：

1. **推荐**：viewport canvas 双色绘制（`waveColor` / `progressColor`），由 playhead 时间切分；**禁止**每帧整窗重绘——仅当 playhead 跨像素或窗口 dirty 时更新 tint 层，或独立 1px 高 progress 条（非 WS progressWrapper）
2. 或：轻量 DOM progress 条叠在 viewport canvas 上（非 WS）

验收：暂停/seek 后已播放区与 playhead 对齐；播放中不把 `playbackFrames` 打回 &lt;45。

### 2D — 文档（同 PR）

- 修订 `desktop-waveform-engine.md`：可见主波形 = Rushi viewport canvas；WS = media
- 关闭本 acceptance 清单；父轨 `waveform-ws-canvas-fps-*` 标注 WS-2b 生产化完成

---

## 3. 明确不做

- ❌ npm 引入 / 迁移 Peaks.js 或 Konva
- ❌ fork WaveSurfer
- ❌ 恢复巨宽 host / mirror `translate3d`
- ❌ 第二 PeakCache / 第二 scroll 真源
- ❌ 把 playhead 画回 WS canvas
- ❌ 本轨重开 SEL-1 / 默认不做 WR-4
- ❌ 为「好看」恢复 WS 全长 peaks 渲染

---

## 4. 验证

```bash
# 定向
cd apps/desktop && npx vitest run \
  src/services/waveform/drawWaveformViewportPeaks.test.ts \
  src/services/waveform/collapseWaveSurferToMediaOnly*.test.ts \
  src/services/waveform/silenceWaveSurferRendererClock*.test.ts \
  src/components/editor/EditorWaveformPeaksStage.test.tsx

# 提交前
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

手测（acceptance S1）：

```js
__rushiScrollProfile.enable()
// 深 zoom 播放 8–10s hands-off
__rushiScrollProfile.print()
__rushiScrollProfile.disable()
```

---

## 5. 与父轨关系

| 轨 | 关系 |
|----|------|
| WS-1 / WS-2a | 已证伪；本轨为正式解 |
| SEL-1 | 已签收；正交 |
| WR-2 | zoom 双轨仍驱动 `drawPxPerSec` → Rushi canvas；不再灌 WS |
| WR-4 | 默认不做 |
