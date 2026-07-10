# Plan：波形播放头单时间源

> **Research**：[waveform-playhead-single-clock-research.md](./waveform-playhead-single-clock-research.md)  
> **Acceptance**：[waveform-playhead-single-clock-acceptance.md](./waveform-playhead-single-clock-acceptance.md)  
> **架构真源**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)

---

## 数据流（目标态）

```text
WS audioprocess (~16ms, rAF)
  → onWsAudioprocess → visualTimeSecRef = timeSec
  → schedulePlaybackViewportFrame → subscribers (scroll-follow P0, playhead P1, label)

seek / seekByDelta / atomicMediaSeek
  → syncDisplayPlayheadAfterSeek(t)  // 同栈，对标 Peaks updatePlayheadTime
  → ws.setTime(t)
  → commitSeekUi(t)                  // pause 态 React + progress

WS seeking 事件
  → setCurrentTime(t) + progress + band paint
  → 暂停态：syncDisplayPlayheadAfterSeek(t)（peaks 重载等 WS-only seek）
  → 播放态：不重同步（audioprocess / 既有 imperative sync）

pause / finish
  → lastTimeUiCommitRef → setCurrentTime → syncPausedTime
```

---

## 切片

| ID | 内容 | 文件 |
|----|------|------|
| **PSC-1** | 移除外推 | `visualPlayheadClock.ts`, `useWaveformVisualPlayheadClock.ts` |
| **PSC-2** | 决策统一 display | `useWaveformPlayback.ts`, `useWaveformTimelineController.ts`（`getDisplayPlayheadTimeSecRef` 接线） |
| **PSC-3** | 删 suppress；播放态 seeking 不重同步；暂停态 seeking 仍 sync | `projectWaveformWaveSurferEvents.ts`, `useProjectWaveform.ts`, `useWaveformSegmentPlaybackControls.ts`；删 `waveformImperativePlayheadSync.ts`, `waveformSelectionSeekChrome.ts` |
| **PSC-4** | 测试 | `*.test.ts` 更新；删 suppress 单测 |
| **PSC-5** | 文档 | industry-research §4 G2 已对齐；`desktop-waveform-engine.md` §播放时钟已改无外推 |

---

## 保留

- `syncDisplayPlayheadAfterSeek` — seek 同栈刷 UI（Peaks 序）
- `subscribePlayheadFrame` + `tierScrollFrameCoordinator` — 单 rAF 合并
- `playbackFollowSuppressUntilRef` — 选中 seek 后禁止播放跟随回拽（与 playhead 时钟无关）
- `pausedImperativeSeekUntilRef` — pause 后防 React `currentTime` 覆盖 imperative seek

---

## 验证命令

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

定向：

```bash
npx vitest run apps/desktop/src/hooks/useWaveformPlayback.test.ts \
  apps/desktop/src/hooks/useWaveformVisualPlayheadClock.test.ts \
  apps/desktop/src/utils/visualPlayheadClock.test.ts \
  apps/desktop/src/hooks/projectWaveformWaveSurferEvents.seekingDedup.test.ts \
  apps/desktop/src/hooks/useWaveformSegmentPlaybackControls.test.ts
```
