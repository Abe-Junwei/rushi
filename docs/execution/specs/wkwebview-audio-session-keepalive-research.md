# 调研：WKWebView 音频会话假死 — AudioKeepAlive 已否决；改媒体操作串行

> **状态**：**已否决保活方案**；生产缓解为 media op queue（S1）  
> **关联业内对照（真调研）**：[`wkwebview-mediaelement-freeze-industry-research.md`](./wkwebview-mediaelement-freeze-industry-research.md)  
> **关联**：`global-segment-playback-cross-switch-research.md`（段播放会话真源）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 段自然结束重播、Space 连按、seek-then-play 导致 WebContent **假死** |
| 采样证据 | `RemoteAudioSession::tryToSetActiveInternal → waitForSyncReply`；第三次卡在 **KeyEvent → `HTMLMediaElement.play()`** 调用栈内 |
| 成功标准 | Space / 段尾单击重播 / 听跳后播放各 ≥20 轮不假死 |

### 根因

- macOS 26 WKWebView：AudioSession 激活为 WebContent→GPU **同步 IPC**
- 本仓 07-07~07-12 播放重构提高 pause↔play 频率

---

## 2. AudioKeepAlive（路线 A）— **已否决 / 有害**

| 复验 | 结果 |
|------|------|
| v1（`hidden` + pause 同步 play） | 仍假死；`hidden` 挂起媒体；同步 resume 嵌套 IPC |
| v2（视觉隐藏 + 延迟 resume） | 仍假死 |
| 第三次采样 | 死锁在 **Space/`play()` 内**；保活未让 `tryToSetActive` early-out；`keydown` 上保活 `play()` 与业务 `play()` **同手势双激活**，可能加剧 |

**结论**：不再挂载、已删除 `AudioKeepAlive` / `silentWavBlob`。禁止再迭代 HTML 静音保活作主修复。

---

## 3. 选定方案（S0 + S1）

| 问题 | 结论 |
|------|------|
| 选定 | **S0** 移除保活；**S1** 全局 media op 串行（pause/seek/play）+ pause→play 最小间隔 + **播放中只 seek、不 pause+play** |
| 不做什么 | 不继续 HTML 保活；本轮不做 WebAudio 后端（S3）/ 原生引擎（S4）/ 私有 WK 开关（S5） |
| 若 S1 后仍假死 | 开 S3 spike（WaveSurfer WebAudio）— 依据见 [industry research](./wkwebview-mediaelement-freeze-industry-research.md) §2 路线 C / Voicebox #293 |

### 手测闸门

强制退出旧假死进程后重新 `tauri dev`，然后：

1. Space 粘性 pause/resume 连按 ≥20 轮
2. 段自然结束 → 单击/Space 重播 ≥20 轮
3. ↑↓ 听跳后播放 ≥20 轮  

全部无 WebContent 假死。若仍假死：`sample <WebContent-pid> 2` 确认是否仍为 `RemoteAudioSession` + `waitForSyncReply`；是则开 S3（WebAudio 后端）spike。

**自动化覆盖（本轮已跑）**：`mediaPlayGate` 串行/间隔；playback controls「全局播放中切段只 seek 不 play」；typecheck + 相关 vitest + arch guard。

---

## 4. 落位

| 层 | 文件 | 变更 |
|----|------|------|
| 移除 | `AudioKeepAlive*` / `silentWavBlob*` / `App` 挂载 | S0 |
| 媒体闸门 | `utils/mediaPlayGate.ts` | 扩展为 op queue + pause→play gap |
| 播放 | `useWaveformSegmentPlayActions.ts` 等 | 播放中 seek-only |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版 AudioKeepAlive |
| 2026-07-12 | v2 修正 hidden；仍失败 |
| 2026-07-12 | **否决保活**；改 S0+S1 media op queue |
