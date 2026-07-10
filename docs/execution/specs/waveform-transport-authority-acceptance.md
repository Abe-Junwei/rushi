# Acceptance：波形 Transport Authority

> **Plan**：[waveform-transport-authority-plan.md](./waveform-transport-authority-plan.md)  
> **Research**：[waveform-transport-authority-research.md](./waveform-transport-authority-research.md)

---

## 1. 能力—行为矩阵

| 用户动作 | Transport | 期望 |
|----------|-----------|------|
| 任意 seek（minimap / blank / seek-within / ←→） | `seek` / `applyPeaksOrderedSeek` | Peaks 序：display sync → `setTime` → commitSeekUi |
| Space / 工具栏播 | `toggleSegmentPlay` → `playSegment` | 无选中 no-op；有选中按 play-from 优先级 |
| 双击语段 | `playSegment` + `fromSec` | 从点击时刻起播 |
| 波形首点未选中 | select + seek 段头 | `previewViewport` 或 SC1 `shouldSeek`；**不**因 SC2 跳过 |
| 已选段内单击 | seek-within | 不以 SC2 当「已选中」 |
| 播放中点另一语段 | defer seek 可，pointerup 仍须 seek | 不得 chrome-match skip |

---

## 2. 自动化验收

- [x] `resolveTransportTargetTime.test.ts` / `dispatchTransportIntent.test.ts` — 矩阵分支
- [x] `useWaveformSegmentPlaybackControls.test.ts` — fromSec / display / raw-lag / resume skip（经 `resolveSegmentPlayFrom`）
- [x] overlay / gesture 既有测试保持绿（无 SC2 fallback）
- [x] 生产接线：`useProjectWaveform.dispatchTransportIntent`；`seek` / `playSegment` / `toggleSegmentPlay` / `selectSegmentTransport` 经 dispatcher（`syncWaveformSegmentSelectViewport` 带 `segmentIdx`）
- [x] 定向 vitest + typecheck + architecture-guard（含「dispatcher 须有生产 import」）
- [x] `npm run typecheck`
- [x] `node scripts/check-architecture-guard.mjs`（0 errors；既有 size warnings）

---

## 3. 手测

| # | 场景 | 期望 | 状态 |
|---|------|------|------|
| H1 | 播放中点另一语段 → Space | 新语段起播后，再按 Space **暂停**（不得因选中清 bound 而 pause+立刻重播）；停播 playhead 不超前一帧 | 待复测 |
| H2 | 未选中点语段；再点同段内 | 选中+段头；再点=seek-within | 待测 |
| H3 | 暂停在 A 中部，选 B，Space | 从 B display/段头起播；raw 滞后不得 resume A；SC1 滞后时仍跟 SC2 chrome | 待复测 |
| H4 | 已选段内单击 | seek 到点击时刻；playhead≈media | 待测 |
| H5 | 空白单击 | seek 到该时刻 | 待测 |
| H6 | 无选中 Space / 工具栏 | no-op / disabled | 待测 |
| H7 | 双击语段 | `fromSec` 起播 | 待测 |

---

## 4. 文档

- [x] `desktop-waveform-engine.md` §Transport Authority
- [x] research / intent / plan 互链
