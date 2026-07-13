# 调研：WKWebView 假死 — 原生音频引擎（S4 · CPAL + Symphonia）

> **状态**：已采纳（maturity：Channel 事件流 · 桌面 MediaElement 回退已移除 · 待桌面手测）  
> **关联**：[`wkwebview-mediaelement-freeze-industry-research.md`](./wkwebview-mediaelement-freeze-industry-research.md) · [`wkwebview-audio-session-keepalive-research.md`](./wkwebview-audio-session-keepalive-research.md)  
> **ADR**：[0008-native-audio-playback-transport.md](../../adr/0008-native-audio-playback-transport.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Space 粘性、段尾重播、听跳后播放时 WebContent 假死 |
| 本仓现状 | Tauri + WKWebView + WaveSurfer MediaElement；S0 已否决保活；S1 media op queue 已落地；**2026-07-12 再次 sample 仍卡在 `RemoteAudioSession::tryToSetActiveInternal → waitForSyncReply`** |
| 成功标准 | 播放真源离开 WebContent；Space/段尾/听跳 ≥50 轮无假死；`sample` 无 RemoteAudioSession 主线程等待 |

### 根因（已证据）

- macOS 26 WKWebView：AudioSession 激活为 WebContent→GPU **同步 IPC**
- S1 只能降频，不能根治
- WaveSurfer WebAudio（S3）整轨 `decodeAudioData` → 长音频 OOM 风险（与听打场景冲突）→ **不做主线**

---

## 2. 业内成熟路线

| # | 路线 | 代表 | 核心机制 | 判定 |
|---|------|------|----------|------|
| A | Electron / Chromium | Descript | 不走 WKWebView RemoteAudioSession | 换壳，否 |
| B | **原生输出引擎** | Audacity / MPV / 多产品 CoreAudio | UI 只驱动 playhead；播放在原生进程 | **选定** |
| C | WaveSurfer WebAudio | Voicebox #293 | 离开 MediaElement | 短音频可行；长音频 OOM → **否决主线** |
| D | HTML KeepAlive | Voicebox #486 | 防 session teardown 无声 | 假死不同症状 → 已否决 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 进度 |
|------|--------|----------|------|------|
| B CPAL+Symphonia | **高** | 本仓已有 `symphonia`（peaks）；Transport Authority；WS-2b PeakCache 视口 | 无第二播放真源；须 ADR | 中高 |
| C WebAudio | 低（主线） | flag spike 可诊断 | 长文件内存 | 否 |

**本仓可复用**：

- `TransportMediaSink` / `dispatchTransportIntent`
- `resolve_audio_path_under_root` / scoped waveform path
- PeakCache + viewport canvas（显示不动）
- `mediaPlayGate`（命令串行）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定 | **Rust CPAL 输出 + Symphonia 流式解码**；前端 `PlaybackTransport` 抽象；桌面 **强制** native，WaveSurfer 仅 peaks/可视化 |
| 控制面 | `tauri::ipc::Channel<NativeAudioEvent>` 有序事件（Ready/Playing/Paused/Seeked/TimeUpdate/Ended/Error）；命令 ACK；**无** snapshot 轮询 / grace |
| 不做什么 | ❌ S3 主线；❌ HTML keepalive；❌ 私有 WKPreference；❌ 双真源；❌ 桌面 MediaElement 回退；❌ 第一版不变调变速 / 设备选择 UI |
| 与 architecture | 对齐 WS-2b：WS/显示与 media transport 分离；时长真源 = 引擎 Ready |
| 风险 | sample-rate 转换；seek 精度；设备热插拔；时钟 IPC 延迟 |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| Rust | `src-tauri/src/native_audio/{engine,decode,clock,events,output,commands,types}` | Channel 事件 + 状态机 + SPSC 无 Mutex |
| UI | `PlaybackTransport` + `useNativePlaybackController` | 生命周期独立于 WS 挂载 |
| 测试 | transport + segment phase + Rust serde 契约 | focused |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] ADR-0008 草案
- [x] 假死复现后用户确认进 S4 编码
- [x] Maturity：Channel 事件流 + 移除桌面 MediaElement 回退

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版：S1 击穿 → 跳过 S3 主线 → S4 CPAL+Symphonia |
| 2026-07-12 | Maturity：Channel 事件权威、拆分 player、controller 生命周期、移除 legacy 回退 |
