# 调研：导入/打开音频容器容错（坏 RIFF WAV）

> **状态**：调研 ✅ · 待编码确认  
> **关联 Plan**：Cursor plan `Import audio normalize`  
> **样例证据**：项目内 `a8eaa92d-….wav`（3h40m / 16 kHz mono PCM / 423MB）；Symphonia `riff: chunk length exceeds parent`；`afinfo`/`ffprobe`/`afconvert` 可读  
> **门禁**：本文签收前不得写业务实现（spike 除外）  
> **扩展**：响度/降噪/工作台/进项目时序见后续 [`av-preprocess-import-flow-research.md`](./av-preprocess-import-flow-research.md)（AV-PRE；容器修复仍属 L-prep-0）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 口述史等长录音常以 WAV 入库；部分录音机/转码工具写出 **错误的 `RIFF.size` / `data.size`**，macOS「显示简介」仍显示正确时长。 |
| 本仓现状 | 导入 = 裸复制（[`project_create_cmd.rs`](../../../apps/desktop/src-tauri/src/project/project_create_cmd.rs) `copy_audio_with_context`）；原生播放 = Symphonia 严探测（[`native_audio/decode.rs`](../../../apps/desktop/src-tauri/src/native_audio/decode.rs)）；peaks 在失败时有 ffmpeg remux（[`waveform_peaks_ffmpeg.rs`](../../../apps/desktop/src-tauri/src/project/waveform_peaks_ffmpeg.rs)），但 **固定 120s** 且 **不修复播放真源**。 |
| 样例根因 | `data.size` 越出 `RIFF` 父块；文件尾相对 RIFF 声明多约 55KB；PCM 载荷按 RIFF 推算与 `afinfo` audio bytes 一致 → **头损坏，数据大体可用**。 |
| 成功标准 | 同类坏 WAV 导入或再次打开后：Symphonia probe 成功、可播可 seek、peaks 可生成；正常文件无额外失败/无感延迟。 |

---

## 2. 业内成熟路线（≥2）

### A. libsndfile / Audacity 系：读头时 **调和 filelength 与 RIFF**

| 项 | 内容 |
|----|------|
| 代表 | [libsndfile `wav.c`](https://github.com/libsndfile/libsndfile/blob/master/src/wav.c)（Audacity 传统导入栈） |
| 机制 | 读 `RIFF` 时若 `filelength` 与声明不一致：打 Warning，并 **改写内存中的 `RIFFsize` / 有效 `filelength`**（过大则截断认知边界，过小则抬升到真实文件长）。不要求用户先手工修文件。 |
| 产品表现 | Audacity 打开「有瑕疵但可解码」的 WAV 往往成功；完全不可解析时才落到 **Import Raw Data**（用户自选采样率）。导入后进入 **工程内部表示**，导出时写出干净头。 |
| 证据 | `wav_read_header`：`filelength > RIFFsize+8` → 截断 `filelength`；`filelength < RIFFsize` → 日志 `should be %D` 并以真实长度纠正。 |

### B. FFmpeg：容错 demux + 可选 `ignore_length` + 常用 remux/转码

| 项 | 内容 |
|----|------|
| 代表 | [FFmpeg `wav` demuxer](https://ffmpeg.org/ffmpeg-formats.html#wav) · [`libavformat/wavdec.c`](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/wavdec.c) |
| 机制 | 对长度不可信时用 **bitrate 估时长**（样例上出现 `Estimating duration from bitrate`）；选项 **`-ignore_length`** 让 data 读到 EOF 而非死守 chunk 长度；全局 `+discardcorrupt` 跳过坏包。NLE/工具链常用「打不开就 ffmpeg 一把」。 |
| 产品表现 | Premiere / 多数转码工具依赖 Media Foundation / AVFoundation / ffmpeg 类 demux，对坏头 **远宽于** 严格解析器。 |

### C. 云转写产品：上传后 **服务端统一 decode 成内部 PCM**

| 项 | 内容 |
|----|------|
| 代表 | Otter / Descript / AssemblyAI 等（导入 FAQ 均为 upload → processing → 可编辑） |
| 机制 | 客户端很少直接用「用户原始容器」做播放权威；ingest 时服务端（或本地等价）**解码到内部格式**，容器瑕疵在管线入口被洗掉。代价是上传/处理时间与存储副本。 |
| 与口述史桌面差异 | Rushi 本机优先、长文件 3h+；**不能默认整段云上传**；但「ingest 时保证可解码真源」的产品意图一致。 |

### D. 苹果 AudioToolbox / `afconvert`：系统 demux 宽容 + 重封装

| 项 | 内容 |
|----|------|
| 代表 | macOS `afinfo` / `afconvert`（样例实测） |
| 机制 | 对同一坏头 WAV，`afinfo` 报正确时长；`afconvert` 可整文件写出合法 CAF（样例 ~4s 完成 423MB 级转换），说明系统栈按 fmt + 可信长度读 PCM，**不因 Symphonia 同款硬错误拒绝**。 |
| 局限 | 非跨平台；Rushi 播放路径已绑 Symphonia，不能只依赖 AudioToolbox。 |

### E. Symphonia（本仓播放器）：**正确性优先，严格拒收**

| 项 | 内容 |
|----|------|
| 代表 | Rushi `native_audio` / peaks 初探 |
| 机制 | `chunk length exceeds parent` 直接失败；适合安全解析，**不适合当唯一 ingest 门禁**（除非上游已规范化）。 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束 | 进度 / 内存 / 运维 |
|------|--------|----------|---------------|-------------------|
| **A libsndfile 调和头** | **高（思路）** | 不引入 libsndfile C 依赖也可自写「PCM WAV 头校验+重写」 | 无网络；外科手术改项目副本 | 毫秒级；3h 文件友好 |
| **B ffmpeg remux** | **高** | 已有 [`remux_audio_to_pcm_wav`](../../../apps/desktop/src-tauri/src/project/waveform_peaks_ffmpeg.rs) + `discardcorrupt` | 已捆绑 ffmpeg；须修 **120s 超时** | 全量重写磁盘 ≈ 源大小；3h40m 可能数分钟 |
| **C 云端 ingest** | 低 | 仅 UX 参考（处理中文案） | 违背本机优先 | 不做 |
| **D 仅 macOS afconvert** | 低–中 | 可作 mac 备选，非主路径 | Windows/Linux 无对等 | 不做主真源 |
| **E 维持严格 Symphonia 拒收** | — | 现状 | 用户可见红字 | **不采纳为产品终态** |

**本仓已有可复用模块（禁止再造第二套）**

- `waveform_peaks_ffmpeg::{remux_audio_to_pcm_wav, symphonia_error_eligible_for_ffmpeg_remux}`
- `native_audio::decode::open_format` / `probe_duration_sec`（门禁应对齐）
- R3e-A `local_transcribe_timeout_secs`（超时按墙钟时长推导的范式）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **分层 ingest（对齐 A→B，门禁用 E）**：L1 廉价 PCM WAV 头调和（libsndfile 思路）→ L2 Symphonia probe → L3 共享 ffmpeg remux（拉长超时）→ L4 再 probe。接线 **导入 + 打开/播放**（双落点，已入库坏文件可自愈）。 |
| 不做什么 | 不默认整段转 16k mono；不引入 libsndfile/GStreamer 新依赖；不以云 decode 为主路径；不把「时长上限」当拒收；不在前端做转码。 |
| 与 architecture | 扩展 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) 已述「peaks remux」为 **项目音频真源 normalize**；播放与 peaks 共用同一套 remux。 |
| 风险 | L3 对超长文件慢 → 必须动态超时 + tmp 原子替换；头调和策略须优先信任 **RIFF 父块与 fmt**（样例尾部多字节当垃圾/填充），避免把垃圾算进时长。 |

**业内对照一句话**：成熟 DAW/工具链是「**宽松 demux 或导入时洗容器**」；云转写是「**服务端统一 decode**」；Rushi 卡在「**复制原件 + 严格播放器**」中间态——应用 **Audacity/libsndfile 式修头 + FFmpeg 回退** 补齐，而不是放宽 Symphonia 本身。

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | 新建 `audio_container_normalize`（project 层）；上提 peaks ffmpeg remux | 新模块 + 抽共享 |
| Rust | `project_create_cmd` 导入 copy 后；`native_audio_load` 打开前 | 接线 |
| Rust | `waveform_peaks_ffmpeg` 超时按时长 | 修常量 |
| UI | 默认可静默；失败文案可读 | 最小 |
| 测试 | 坏头 fixture + remux timeout 单测 | 新增 |

---

## 6. 签收

- [x] 调研 brief 完成（业内 ≥2：libsndfile/Audacity、FFmpeg、云 ingest、afconvert、Symphonia）
- [x] Plan 已链接本文并进入编码
- [x] 用户确认进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：样例头损坏实测 + 业内路线与落位决策 |
| 2026-07-13 | 实现：`audio_container_normalize` + 导入/打开接线 |
