---
adr: "0008"
title: 桌面端播放真源迁至 Rust 原生音频（CPAL + Symphonia）
status: accepted
date: 2026-07-12
supersedes: null
related: ["0004", "0005"]
---

# ADR-0008：原生音频播放 Transport

## 上下文

- macOS 26 WKWebView 上 WaveSurfer **MediaElement** 触发 `RemoteAudioSession` 同步 IPC 假死（多次 `sample` 证实）。
- S0 AudioKeepAlive 已否决；S1 media op queue 降频仍复现死锁。
- WaveSurfer **WebAudio**（S3）对长听打文件有整轨 `AudioBuffer` OOM 风险，不作为主线。
- WS-2b 已将可见波形迁至 PeakCache 视口 canvas；WaveSurfer 仅作可视化 / peaks。

Research：[`wkwebview-native-audio-engine-research.md`](../execution/specs/wkwebview-native-audio-engine-research.md)

## 决策

1. **播放真源** = Tauri 进程内 **CPAL 输出 + Symphonia 流式解码**（单一引擎）。
2. 前端保留 **Transport Authority**（`dispatchTransportIntent`）；经 `PlaybackTransport` 适配器调用 native。
3. **桌面端禁止** WaveSurfer 加载 `url` / 调用 `play()`，避免双真源与 WK AudioSession（`requireTransport` 恒真）。
4. 路径经 `resolve_audio_path_under_root`（或等价 scoped resolve）；禁止任意路径播放。
5. **引擎 → 前端** 使用 `tauri::ipc::Channel<NativeAudioEvent>` 有序事件流（Ready/Playing/Paused/Seeked/TimeUpdate/Ended/Error）；不再依赖 snapshot 轮询与 grace window。
6. **时长真源** = 引擎 probe / Ready 事件；layout/peaks 时长仅为 hint。
7. **第一版不做**：不变调变速、输出设备选择 UI、WebAudio 默认、HTML keepalive、私有 WKPreference。
8. Legacy MediaElement 播放回退已移除；`rushi.p1.nativeAudioPlayback` pref 不再开关真源（读侧恒为开启）。

## 后果

### 正面

- 根治 WKWebView MediaElement 假死路径
- 长音频内存可控（ring buffer，非整轨 PCM）
- 显示与播放解耦，与 WS-2b 一致
- 控制面 ACK + 事件流，避免乐观 UI / 轮询竞态

### 负面

- CPAL/采样率/设备热插拔复杂度
- 需维护 adapter + ACL permissions
- seek 精度依赖容器关键点

## 状态

**accepted** — 2026-07-12（S1 击穿后进入实现；2026-07-12 maturity：Channel 事件流 + 移除桌面 MediaElement 回退）
