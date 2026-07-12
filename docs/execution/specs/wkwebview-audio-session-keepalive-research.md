# 调研：WKWebView 音频会话保活（AudioKeepAlive）— 消除段播放/暂停触发的 WebContent 假死

> **状态**：已采纳
> **关联**：`global-segment-playback-cross-switch-research.md`（段播放会话真源）
> **门禁**：本文为「假死根因 + 修复方案」调研；实现已随本文落位

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 段自然播放结束后再次播放，或反复 play/pause / seek-then-play，应用**整体假死**（WebContent CPU 0%，主线程卡在同步 IPC 等待） |
| 本仓现状 | 采样栈：`RemoteAudioSession::tryToSetActiveInternal → sendSyncMessage → waitForSyncReply → BinarySemaphore`。播放路径：`useWaveformSegmentPlayActions` / `useWaveformSegmentPlaybackBoundSync` / Transport Authority（`services/waveform/transport/*`） |
| 成功标准 | 段自然结束→单击重播、连续 play/pause/seek 若干轮，**不再假死**；新增单测通过；机器守卫全绿 |

### 根因（为什么「最近才有」）

- **环境前提**：macOS 26 WKWebView 把 `<audio>` 播放迁入 GPU 进程，激活整机 CoreAudio 会话改为 **WebContent→GPU 的同步 IPC**（`AudioSession::tryToSetActive`）。每次 `inactive→active` 冷激活都可能嵌套该同步等待并死锁。旧 macOS 走进程内激活，无跨进程同步等待，故从不假死。
- **暴露放大（本仓改动，2026-07-07 → 07-12）**：
  - `e908d0e` 统一播放头时钟 + 原子 seek（seek 后立刻 play 的连发序列）
  - `8cfcfb2` Transport Authority 集中化 + `d2d4c4c` past-end play（所有点选/听跳/段操作都走 seek(+play) 派发）
  - `e87bf68` 恢复全局播放 + 转写跟随
  - `0f757a7` 粘性 Space（pause-keep-session / resume，play↔pause 循环暴增）
  - `d77071b` 新增 `mediaPlayGate`（本身即证据：彼时已在假死才加互斥；但挡不住 WebKit runloop 内自发的同步激活）
- 结论：OS 升级把「原本无害的 play/pause 会话切换」变成致命同步等待；本轮播放重构把切换频率抬到必现。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **静音保活元素**（Silent keep-alive audio） | Electron/Tauri 音频类桌面应用、WebRTC 保活常见做法 | 常驻一个 loop 的静音 `<audio>`，让整机音频会话**常热**，业务播放不再触发冷激活 | 本方案 |
| B | 禁用 GPU 进程媒体 / 走 WebAudio | WKWebView 相关规避讨论 | 让音频不经 RemoteAudioSession 同步 IPC | 不适用：WS `MediaElement` 后端仍走 `<audio>`；改 WebAudio 后端会重写整条波形播放 |
| C | 每次播放前 try/catch + 播放互斥 | 本仓 `mediaPlayGate` | JS 层串行化 `play()` | 已在用，**不足以**根治（WebKit 自身在 runloop 内发同步激活） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 静音保活 | 高 | 纯前端，零后端改动；不碰 WS 播放链路 | 无（不引入第二套播放真源） | 内存：一个 ~16KB 静音 WAV blob + 常驻 `<audio>`；无进度 UX |
| B WebAudio 后端 | 低 | — | 需重写 `useProjectWaveform` / Transport | 高风险 |
| C 播放互斥 | 中 | 已存在 | 仅缓解 | — |

**本仓已有可复用模块**：`mediaPlayGate`（保留，作二线防御）、Transport Authority（不改）。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A：AudioKeepAlive**——app 根挂载常驻静音 loop `<audio>`，固定 CoreAudio 会话为 active，消除冷激活同步 IPC |
| 不做什么 | 不改 WaveSurfer 播放后端；不移除 `mediaPlayGate`；不引入第二套播放真源；不做后端/侧车改动 |
| 与 ADR / architecture 关系 | 与 `global-segment-playback-cross-switch-research.md` 段会话模型一致；纯 UI 层新增 |
| 风险与 spike 项 | autoplay 策略可能拦首帧播放 → 已加首个用户手势（pointerdown/keydown）兜底重试；host 暂停 → `pause` 事件自动恢复 |

---

## 5. 落位

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI util | `apps/desktop/src/utils/silentWavBlob.ts` | 新增：零 PCM WAV 字节 + object URL |
| UI 组件 | `apps/desktop/src/components/AudioKeepAlive.tsx` | 新增：常驻静音 `<audio>` 保活 |
| UI 挂载 | `apps/desktop/src/App.tsx` | 根节点挂载 `<AudioKeepAlive/>` |
| 测试 | `silentWavBlob.test.ts` / `AudioKeepAlive.test.tsx` | 新增 focused tests |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 实现落位并链接本文（`AudioKeepAlive.tsx` 顶部注释）
- [ ] 用户手测：段自然结束单击重播 + 反复 play/pause/seek 不假死

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版：根因（macOS 26 RemoteAudioSession 同步激活）+ AudioKeepAlive 方案 |
