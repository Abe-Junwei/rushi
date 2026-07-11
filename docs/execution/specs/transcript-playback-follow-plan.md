# Plan：文稿跟随播放头

> **Research**：[transcript-playback-follow-research.md](./transcript-playback-follow-research.md)

## 步骤

1. `utils/transcriptPlaybackFocus.ts` — 是否应 reveal（suppress 输入）
2. `playbackFocusField.ts` — CM6 effect + line deco；挂入 `transcriptEditorCoreExtensions`
3. `waveformPrefs` — `rushi.p1.transcriptPlaybackFollow`（默认 on）
4. `useTranscriptPlaybackFollow` — subscribePlayheadFrame；写 focus；条件 `revealSegmentInView`；list 选中标记 divert
5. `EnvPreferencesPanel` 开关；architecture 一行
6. 单测

## 验证

```bash
cd apps/desktop && npx vitest run \
  src/utils/transcriptPlaybackFocus.test.ts \
  src/components/editor/core/playbackFocusField.test.ts \
  src/hooks/useTranscriptPlaybackFollow.test.ts
```
