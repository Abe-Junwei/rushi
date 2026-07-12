# Acceptance：文稿跟随播放头

> **Research**：[transcript-playback-follow-research.md](./transcript-playback-follow-research.md)  
> **状态**：自动化 ✅；手测 ✅（2026-07-12）

## 能力—UI 矩阵

| 能力 | 条件 | UI | 期望 |
|------|------|-----|------|
| 跟播高亮 | playing + pref on | `cm-transcript-playback-focus` | 索引随 playhead；不改 selection |
| 跟播滚动 | 索引变化且未 suppress | `revealSegmentInView` | 播出句入视口 |
| suppress | 手滚 / list 选偏离 | — | 只更新装饰（编辑 focus 不抑制跟滚） |
| 跟播视觉 | playing + pref on | 高级灰铺底（meta/stage/正文） | **≠** 选中 saffron；无灰条 |
| 选中∩跟播 | primary == playback | 更深 saffron 铺底（三列） | `--segment-fill-selected-playing-list` |
| 偏好关 | pref off | — | 无装饰无滚 |
| 暂停 | !playing | — | 清除 focus |

## 自动化

- [x] `transcriptPlaybackFocus.test.ts`
- [x] `playbackFocusField.test.ts`
- [x] `useTranscriptPlaybackFollow.test.ts`
- [x] `waveformPrefs.test.ts`（跟播偏好默认 on）

## 手测

1. [x] 全局播：文稿跟滚当前句；选中可不在该句
2. [x] 播中点远处改稿：不 seek、不强制滚回；暂停后再播可恢复跟滚
3. [x] 偏好关闭：无跟播
