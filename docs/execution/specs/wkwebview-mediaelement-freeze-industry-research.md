# 调研：macOS WKWebView 音频假死 — 业内如何规避（对照 Rushi）

> **状态**：已采纳（调研结论；编码以既有 S0/S1 为准，S3 仅假死复现后 spike）  
> **关联**：[`wkwebview-audio-session-keepalive-research.md`](./wkwebview-audio-session-keepalive-research.md)（保活否决记录）· [`global-segment-playback-cross-switch-research.md`](./global-segment-playback-cross-switch-research.md)（粘性 Space 产品决策）  
> **门禁**：本文回答「别家怎么躲」；**禁止**据此无 spike 直接上 WebAudio 全量切换或原生第二播放栈

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 段播 / Space 粘性 pause·resume / 听跳后播放时，Rushi 桌面端 **WebContent 假死**（整窗无响应） |
| 本仓证据 | 三次 `sample`：`RemoteAudioSession::tryToSetActiveInternal → waitForSyncReply`；第三次入口为 **KeyEvent → `HTMLMediaElement.play()`**（非事后回调） |
| 本仓栈 | Tauri 2 + **系统 WKWebView** + WaveSurfer **默认 MediaElement**（[`useProjectWaveformMount.ts`](../../../apps/desktop/src/hooks/useProjectWaveformMount.ts)） |
| 成功标准 | 说清业内 ≥2 条成熟路线、与 Rushi 复用度、**不做什么**；假死复现时有可执行的下一 spike |

### 根因分层（调研前提）

1. **平台**：macOS 26 WebKit 将媒体会话激活做成 WebContent→GPU **同步 IPC**（历史相关：[WebKit #223564](https://bugs.webkit.org/show_bug.cgi?id=223564) RemoteAudioSession + GPUP hangs，FIXED 于旧版；**新系统上同类同步等待仍可卡死**）。
2. **产品放大**：2026-07-12 会话粘性 Space（[`0f757a7`](https://github.com/) 等）提高 pause↔play 频率 → 更容易撞上同步激活。
3. **不是**「粘性 UX 本身错误」；是 **MediaElement + 密 play/pause + WKWebView** 组合致命。

---

## 2. 业内成熟路线（≥3，可验证）

### 2.1 对照总表

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| **A** | **换渲染栈：Electron / Chromium** | Descript（`electron.descript.com` DMG / Homebrew cask） | 自带 Chromium，**不走** macOS WKWebView GPU `RemoteAudioSession` 同步激活路径 | [Homebrew descript cask](https://github.com/Homebrew/homebrew-cask/blob/master/Casks/d/descript.rb)（`url "https://electron.descript.com/..."`） |
| **B** | **原生音频引擎** | Audacity、Premiere、部分播放器 MPV/CoreAudio | UI 可 Web/原生；**播放真源在原生进程**；Web 只发 transport 命令 | 产品架构惯例；NSMusicS 等 Electron+MPV 双引擎公开文档 |
| **C** | **同栈 Tauri：弃 MediaElement → WaveSurfer WebAudio** | [Voicebox #293](https://github.com/jamiepine/voicebox/pull/293)（Tauri + WaveSurfer） | 作者明确：MediaElement **触发 WKWebView media pipeline deadlock、整应用假死**；改 `backend: WebAudio` + **单实例复用** | PR merged 2026-03 |
| **D** | **静音保活 HTML `<audio>`** | [Voicebox #486](https://github.com/jamiepine/voicebox/pull/486)；部分 Web 播放器 | 常驻 silent PCM loop，防 **后台久置后 CoreAudio 会话被拆 → 有 UI 无声** | PR 写明：治 teardown/无声；**不是** sync IPC 死锁的同构症状 |
| **E** | **降 play/pause 密度（产品或闸门）** | Otter/Descript（Space≈单 transport）；Rushi S1 | Space 不粘段会话、或 JS 串行 pause/seek/play、播放中只 seek | 本仓 `mediaPlayGate` + 粘性 UX research |

### 2.2 分路线说明

#### A — Electron（Descript 等）

- **如何规避**：根本不进入 WKWebView 的 RemoteAudioSession sync 路径。
- **对 Rushi**：等于换壳（Tauri→Electron），成本极高；**非本薄片方案**。
- **启示**：听打大厂「不假死」≠「在 WKWebView 里修好了 MediaElement」。

#### B — 原生播放（S4）

- **如何规避**：WebContent 主线程不再在 `HTMLMediaElement.play` 里 `waitForSyncReply`。
- **对 Rushi**：长期根治候选；须新建 Rust/CPAL（或等价）播放真源 + playhead 回传；**禁止**第二套并行 transport 真源未立项前乱造。

#### C — WaveSurfer WebAudio（S3，同病同药）

- **Voicebox #293 原文要点**：
  - MediaElement → WKWebView deadlock / freeze entire Tauri app
  - 改为 WebAudio backend
  - **Reuse single WaveSurfer**（避免反复 create 耗尽 AudioContext）
- WaveSurfer v7 API：`backend?: 'WebAudio' | 'MediaElement'`（[wavesurfer.js typings](https://github.com/katspaugh/wavesurfer.js/blob/main/dist/wavesurfer.d.ts)）；实现用 `WebAudioPlayer`。
- **局限**：WebAudio 仍可能碰系统 AudioSession；长文件整段 decode → **内存**；seek/loop/Transport 需回归。**不保证**根除，但是 **唯一有公开「WKWebView 假死 → 切 WebAudio」成功叙事的同栈先例**。

#### D — AudioKeepAlive

- **Voicebox #486 原文要点**：后台久了 → `play()` 成功但 **无声**；cmd+R 无效，须重启进程；保活防 **session teardown**。
- 作者曾试：换回非 WebAudio、remount、`ctx.resume()` → **都不治无声**。
- **Rushi 复验**：保活对 **sync IPC 死锁无效且有害**（同手势双 `play`）。见 keepalive research。
- **结论**：D 与「假死」是 **不同症状**；禁止用 D 当假死主修复。

#### E — 降频 / 串行（S1，已落地）

- 业内「钝」UX（Otter：Space=pause）或工程闸门（串行 + pause→play gap + 播放中 seek-only）。
- Rushi 手测：**假死已停**；粘性 Space 产品目标仍保留，靠闸门降触发率。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|---------------|---------------------|
| A Electron | **低** | 无（架构换壳） | 违背当前 Tauri 选型 | 极高 |
| B 原生引擎 | **中**（长期） | Transport Intent 边界可保留 | 新播放真源须 ADR；禁止双真源 | 高；根治 |
| C WebAudio | **高**（spike） | `WaveSurfer.create({ backend: 'WebAudio' })`；单实例挂载纪律 | peaks/长音频内存；时钟/bound 回归 | 中；**假死复现时优先** |
| D KeepAlive | **否决** | — | 已证伪对死锁；加剧双 play | — |
| E 串行/降频 | **高（已用）** | `mediaPlayGate`、seek-while-playing | 与粘性 UX 张力：闸门可留、产品粘性可留 | 低 |

**本仓已有可复用模块（必须先扩展再造轮）**：

- `apps/desktop/src/utils/mediaPlayGate.ts`（S1 串行）
- `useWaveformSegmentPlayActions` / Transport Authority
- `useProjectWaveformMount`（唯一 WS create 落点）
- peaks 预加载路径（WebAudio spike 时优先继续喂 peaks，避免整轨 decode）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **别家如何规避** | ① 不跑 WKWebView（Electron/原生）；② 同栈则 **弃 MediaElement→WebAudio**（Voicebox）；③ 降 play/pause 密度；④ KeepAlive 只治「无声」不治「假死」 |
| **选定（当前）** | **维持 E（S0/S1）** 作为生产缓解；**保活 D 保持否决** |
| **下一动作门禁** | 仅当假死 **再次可复现** 时开 **C（S3）spike**（≤1–2 天）：`backend: 'WebAudio'` + 单实例 + Space/段尾/听跳各 ≥20 轮 + `sample` 对比栈 |
| **不做什么** | ❌ 再迭代 HTML 保活治假死；❌ 无调研换 Electron；❌ 无 ADR 上原生第二播放栈；❌ 未 spike 就全仓切 WebAudio |
| **与 ADR / architecture** | 对齐 `desktop-waveform-engine` Transport Authority；WebAudio 仍须经同一 transport，禁止组件直调第二套 play |
| **风险** | S3 后仍假死 → 升级评估 B；S3 内存爆 → 限长文件或继续 MediaElement+更严闸门 |

---

## 5. 落位预告（S3 spike 时，非现在编码）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `useProjectWaveformMount.ts` | spike：`backend: 'WebAudio'`（feature flag） |
| UI | WaveSurfer 生命周期 | 禁止按 URL destroy/recreate 风暴（对齐 Voicebox） |
| 测试 | playback controls + 手测矩阵 | 假死闸门 + 段 bound/loop |
| 文档 | 本文 §6 勾选 + keepalive research 回链 | 记录 sample 前后栈 |

---

## 6. 签收

- [x] 调研 brief 完成（业内对照 + 复用表 + 决策）
- [x] S3 实现策略评估（§7）
- [ ] intent / plan / acceptance 链接本文（仅当启动 S3/S4 编码薄片时）
- [ ] 用户确认：假死复现后再开 S3；当前不编码 WebAudio

---

## 7. S3 实现策略评估（WebAudio）

> **评估结论（一句话）**：S3 不能照搬 Voicebox「全局 `backend: 'WebAudio'`」；Rushi 已是 **WS-2b media-only + 长音频 peaks**，库存 WaveSurfer WebAudio = **整轨 `fetch → decodeAudioData → AudioBuffer`**，与听打长文件内存模型冲突。假死复现时应用 **有时长门禁的 spike + 单实例纪律 + 保留 S1**，失败则升 S4，禁止半成品双后端长期并存。

### 7.1 本仓约束（决定策略形态）

| 约束 | 现状 | 对 S3 的含义 |
|------|------|--------------|
| WS 职责 | [desktop-waveform-engine](../../architecture/desktop-waveform-engine.md)：WS = **media transport**；可见波形 = Rushi PeakCache canvas（WS-2b stub peaks） | 切后端**不改**显示管线；只换播放宿主 |
| 挂载 | [`useProjectWaveformMount.ts`](../../../apps/desktop/src/hooks/useProjectWaveformMount.ts)：`WaveSurfer.create({ url, peaks: stub, … })`，**无** `backend` → 默认 MediaElement | 改动面极小：create options + 生命周期 |
| URL 变更 | `mediaUrl` 变化 → `destroyWave()` 再 create | WebAudio 下反复 create/destroy **会耗尽 AudioContext**（Voicebox #293 第二刀）；须改为 **单实例 + `load()`** 或严格 close 后再建 |
| 播放入口 | Transport → `ws.play` / `pause` / `setTime`；[`mediaPlayGate`](../../../apps/desktop/src/utils/mediaPlayGate.ts) 串行 | API 表面兼容；**S1 闸门应保留**（WebAudio `play` 仍可能碰 AudioSession） |
| 库存 WebAudio | `node_modules/wavesurfer.js/dist/webaudio.js`：`src` setter → **整文件 arrayBuffer + decodeAudioData** | 小时级音频 → **数百 MB～数 GB PCM**；首播延迟 = 全量 decode |
| Voicebox 场景 | 短语音轨 / 历史条目切换 | 与 Rushi 长转录 **不可同构** |
| ADR | ADR-0004：「不替换 WaveSurfer 播放后端」 | S3 生产化须修订 ADR / architecture 一句 |

### 7.2 策略选项（比选）

| 方案 | 做法 | 优点 | 缺点 | 推荐 |
|------|------|------|------|------|
| **S3-A 全仓默认 WebAudio** | create 固定 `backend: 'WebAudio'` | 最简；贴近 Voicebox | 长文件内存/首载爆炸；违反本仓 peaks-first 精神 | **否** |
| **S3-B 时长门禁** | `duration ≤ T`（建议 spike 初值 **≤ 15–20 min** 或 peak RAM 预算）用 WebAudio；否则 MediaElement + 既有 S1 | 假死高发短中文件可试药；长文件不炸内存 | 双路径；须测边界；超长仍靠 S1 | **spike 首选** |
| **S3-C 假死复现后强制 WebAudio（无门禁）** | 仅 debug flag / localStorage 全开 | 最快对照 `sample` 栈 | 不可当默认生产 | 仅作 **诊断开关** |
| **S3-D 自研流式 WebAudio / Worklet** | 分段 decode + 调度 | 长文件友好 | 等于新播放引擎；远超 spike；与 S4 重叠 | **否（并入 S4 评估）** |
| **S3-E 仅改生命周期（仍 MediaElement）** | 单实例 reuse，不换 backend | 降 recreate 压力 | **不治** `HTMLMediaElement.play` sync IPC | **否作假死主线** |

### 7.3 推荐落地形态（假死复现后的 spike）

**目标**：验证「离开 `HTMLMediaElement.play`」是否让 `RemoteAudioSession + waitForSyncReply` 假死消失；**不**承诺生产默认切换。

```text
1. Feature flag（localStorage / 开发 prefs）
   rushi.waveform.backend = 'auto' | 'media' | 'webaudio'
   auto = durationSec ≤ THRESHOLD ? webaudio : media

2. Mount（唯一 create 点）
   WaveSurfer.create({ …existing, backend: resolved })
   - 仍注入 stub peaks + duration（WS-2b 不变）
   - WebAudio 路径：接受 decode 等待；ready 前禁止 Space 连发（或 gate busy）

3. 生命周期（硬纪律，Voicebox 教训）
   - 同会话内切文件：优先 ws.load(url, stubPeaks, duration)，禁止 destroy/recreate 风暴
   - 卸载：destroy 一次并确保 AudioContext.close
   - MediaElement 路径可维持现有 destroy-on-url（或一并统一 load，二选一在 spike 定）

4. 保留 S1
   - mediaPlayGate 继续包 pause/seek/play
   - 播放中切段仍 seek-only
   - 不因 WebAudio 拆闸门（即使假死消，闸门成本低）

5. 明确不做
   - 不恢复 AudioKeepAlive
   - 不做 GainNode 静音 scrub 花活（Voicebox 旁支）
   - 不改 PeakCache / viewport canvas
   - 不上 S3-D 流式自研
```

### 7.4 落位与 blast radius

| 层 | 文件 | Spike 变更 |
|----|------|------------|
| 挂载 | `useProjectWaveformMount.ts` | `backend` + 可选 load 复用 |
| 销毁/换轨 | `useProjectWaveformDestroy.ts` / mount effect deps | 单实例策略 |
| 闸门 | `mediaPlayGate.ts` | 注释扩到 WebAudio；行为尽量不动 |
| 偏好 | `waveformPrefs` 或等价 | flag + threshold |
| 文档 | 本文 + `desktop-waveform-engine.md` 一句 | spike 签收后 |
| ADR | ADR-0004 修订 | **仅生产默认切换时** |

Transport / 段 bound / sticky Space / loop：**预期零业务语义改动**；回归测即可。

### 7.5 验证与 kill 条件

| 闸门 | 通过标准 | 失败 → |
|------|----------|--------|
| **假死** | Space/段尾/听跳各 ≥20 轮；`sample` 无 `HTMLMediaElement.play`→`waitForSyncReply` 卡死 | 升 **S4**；或加固 S1 + 产品降频 |
| **内存** | 门禁内文件：Activity Monitor WebContent 增长可接受（spike 记峰值）；超门禁不走 WebAudio | 下调 THRESHOLD 或放弃默认 |
| **首载** | 门禁内 decode 可接受（spike 记 p95）；超时有错误态 | 缩短门禁 / 预热策略 |
| **功能** | seek、段 bound、loop、粘性 Space、全局播放出口与现网一致 | 修时钟/事件差异；不扩大范围 |
| **生命周期** | 连续换 ≥30 个短文件无「无声 / AudioContext 耗尽」 | 强制单实例 + close |

### 7.6 风险与残余不确定性

1. **不保证根除**：WebAudioPlayer 仍设 `navigator.audioSession.type = 'playback'` 并 `AudioContext`；若假死在 `AudioContext.resume` 同类 sync 路径，S3 无效 → S4。
2. **时钟语义**：WebAudio 用 BufferSource + `playbackPosition`；段尾 pause-only / `stopAt` 行为需对照现网。
3. **双路径成本**：`auto` 门禁增加测试矩阵；须文档写清「超长仍 MediaElement+S1」。
4. **与 WS-2b 叙事**：架构上 WS 已是 media-only；换 backend **不**动摇 peaks 模型，但须在 arch 注明「media 后端可选」。

### 7.7 决策摘要（策略层）

| 问题 | 结论 |
|------|------|
| 现在编码？ | **否**（假死未复现则维持 S1） |
| Spike 怎么做？ | **S3-B**：flag + 时长门禁 + stub peaks 保留 + 单实例 load + **保留 S1** |
| 默认生产？ | Spike PASS 且假死证据充分后再议；长文件默认仍 MediaElement |
| 失败升级？ | S3 仍假死或内存不可接受 → **S4 原生引擎调研**，不堆 KeepAlive / 不堆流式半成品 |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版：Descript=Electron；Voicebox #293 WebAudio 治假死；#486 KeepAlive 治无声；Rushi 维持 S1，S3 有条件 |
| 2026-07-12 | §7：S3 策略评估 — 否全仓 WebAudio；spike 用时长门禁 + 单实例 + 保留 S1 |
