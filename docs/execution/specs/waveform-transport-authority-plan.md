# Plan：波形 Transport Authority

> **Research**：[waveform-transport-authority-research.md](./waveform-transport-authority-research.md)  
> **Acceptance**：[waveform-transport-authority-acceptance.md](./waveform-transport-authority-acceptance.md)  
> **架构真源**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)

---

## 目标态数据流

```text
TransportIntent
  → resolveTransportTargetTime / resolveSegmentPlayFrom
  → syncDisplayPlayheadAfterSeek(t)   // Peaks 序
  → ws.setTime(t) | ws.play() | ws.pause()
  → commitSeekUi + segment bound arm/clear
  → schedulePlaybackViewportFrame
```

Display 消费者仍只读 `getDisplayPlayheadTimeSec()`。SC2 只做 chrome。

---

## Intent 面

```ts
type TransportIntent =
  | { kind: "seek"; timeSec: number; source: TransportSource; suppressFollow?: boolean }
  | { kind: "playSegment"; idx: number; fromSec?: number; loop?: boolean }
  | { kind: "toggleSegmentPlay" }
  | { kind: "pause" }
  | { kind: "selectSegmentTransport"; idx: number; source: SegmentSelectSource;
      seekPolicy: "segmentStart" | "none" | "pointerTime"; pointerTimeSec?: number }
```

Play-from 优先级（写死）：

1. `fromSec`（钳在段内）
2. `display` 在段内 → 用 display
3. `|raw - display| ≤ ε` 且 raw 在段内 → resume skip seek（`playFrom = null`）
4. 否则 `resolveSegmentPlaybackStartSec(display, seg)`（通常段头）

---

## 切片

| ID | 内容 | 文件 |
|----|------|------|
| **TA-1** | Spec 四件套 | `docs/execution/specs/waveform-transport-authority-*` |
| **TA-2** | Core + 单测 | `services/waveform/transport/*` |
| **TA-3** | Play 接线 | `useWaveformSegmentPlaybackControls.ts` → `resolveSegmentPlayFrom` |
| **TA-4** | Seek / select | playback seek 保持 Peaks 序；selection 继续 SC1/`previewViewport` 真源（已禁 SC2 skip） |
| **TA-5** | Docs + guard | `desktop-waveform-engine.md`；guard allowlist `ws.setTime` |

---

## 验证命令

```bash
npm run typecheck
npx vitest run apps/desktop/src/services/waveform/transport \
  apps/desktop/src/hooks/useWaveformSegmentPlaybackControls.test.ts \
  apps/desktop/src/hooks/useWaveformPlayback.test.ts \
  apps/desktop/src/utils/waveformSegmentOverlayActions.test.ts \
  apps/desktop/src/services/waveform/waveformSelectionGesture.test.ts
node scripts/check-architecture-guard.mjs
```
