# Intent：文稿跟随播放头（Playback Focus）

> **Research**：[transcript-playback-follow-research.md](./transcript-playback-follow-research.md)  
> **Plan**：[transcript-playback-follow-plan.md](./transcript-playback-follow-plan.md)  
> **Acceptance**：[transcript-playback-follow-acceptance.md](./transcript-playback-follow-acceptance.md)  
> **状态**：编码完成（待手测）

## 意图

全局（及任意）播放时，文稿以 **Playback Focus** 弱高亮并条件跟滚当前播出语段；与 CM6 selection 正交，对齐 Descript「播放中可独立编辑」+ Otter 跟读。

## 范围

| 薄片 | 交付 |
|------|------|
| PF-1 | research / intent / plan / acceptance |
| PF-2 | 纯函数 + CM6 playbackFocusField + prefs |
| PF-3 | `useTranscriptPlaybackFollow` 接线 + 偏好开关 |
| PF-4 | 定向测试 |

## 不做

- 词级高亮；点文稿 seek；跟播改 selection
