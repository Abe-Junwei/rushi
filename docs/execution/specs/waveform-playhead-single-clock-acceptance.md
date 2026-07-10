# Acceptance：波形播放头单时间源

> **Plan**：[waveform-playhead-single-clock-plan.md](./waveform-playhead-single-clock-plan.md)  
> **Research**：[waveform-playhead-single-clock-research.md](./waveform-playhead-single-clock-research.md)

---

## 1. 能力—UI 行为矩阵

| 用户动作 | 播放头显示 | 语段播/决策时间 | 备注 |
|----------|-----------|----------------|------|
| 播放中 audioprocess | `visualTimeSecRef` = WS 报告值 | 同左 | 无外推 |
| pause 后 ←→ seekByDelta | 同栈 `syncDisplayPlayheadAfterSeek` | `getDisplayPlayheadTimeSec()` | 单源 |
| 播放中按空格语段播 | 段内位置 | `resolveSegmentPlaybackStartSec(display, seg)` | 不跳段头 |
| 双击语段播 | 点击点 | `fromSec` 钳在段内 | 已有 |
| 首次点未选中语段 | 语段头 | pointerdown preview seek | viewportSynced 修复 |
| WS seeking 事件（暂停） | `syncDisplayPlayheadAfterSeek` + `setCurrentTime` | 覆盖 peaks 重载等 WS-only seek |
| WS seeking 事件（播放） | 不重复 sync playhead | `audioprocess` / 既有 imperative sync |

---

## 2. 自动化验收

### 2.1 新增/更新

- [x] `visualPlayheadClock.test.ts` — 钳制到 duration，无外推断言
- [x] `useWaveformPlayback.test.ts` — `getPlayheadTime` / `seekByDelta` 读 `getDisplayPlayheadTimeSecRef`
- [x] `projectWaveformWaveSurferEvents.seekingDedup.test.ts` — **暂停** seeking 调 sync；**播放** seeking 不调
- [x] `useWaveformVisualPlayheadClock.test.ts` — audioprocess 直写 ref

### 2.2 删除

- [x] `waveformImperativePlayheadSync.test.ts`
- [x] `waveformSelectionSeekChrome.test.ts`

### 2.3 守卫

- [x] `npm run typecheck`
- [ ] `npm run test`（全量；本薄片以定向 vitest 为准，全量仓库另有既有 jsdom 失败）
- [x] `node scripts/check-architecture-guard.mjs`

定向（2026-07-09）：`useWaveformPlayback` / `useWaveformVisualPlayheadClock` / `visualPlayheadClock` / `seekingDedup` / `useWaveformSegmentPlaybackControls` / `waveformDisplayPlayhead` / `projectWaveformWaveSurferEvents` — **30/30 通过**。

---

## 3. 手测

| # | 场景 | 期望 | 状态 |
|---|------|------|------|
| H1 | 播放中，播放头在语段中段，按空格 | 从当前播放头起播，不跳段头 | 待测 |
| H2 | 暂停，seek 到语段中段，按空格 | 从 seek 位置起播 | 待测 |
| H3 | 点未选中语段中部 | 选中 + 播放头在语段头（不跳回点击点） | 待测 |
| H4 | 已选中语段再点中部 | seek 到点击点 | 待测 |
| H5 | 播放中 center follow | 播放头居中，滚动顺滑 | 待测 |
| H6 | pause 后 ←→ | 播放头不倒退 | 待测 |

---

## 4. 文档

- [x] `waveform-playhead-single-clock-research.md` §6 intent/plan/acceptance 已链接
- [x] `waveform-playhead-seek-industry-research.md` §4 G2 标注已对齐
- [x] `desktop-waveform-engine.md` §播放时钟 与单时间源实现对齐（无外推）
