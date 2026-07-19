# 调研：Native Audio 保音高变速

> **状态**：已采纳（2026-07-19）  
> **关联 ADR**：[ADR-0008](../../adr/0008-native-audio-playback-transport.md)  
> **门禁**：本薄片只修复原生播放倍速音质；不改 Transport Authority、播放时钟、波形滚动或设备选择 UI。

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 听写时常用 0.75x、1.25x、1.5x；期望语速变化但人声音高不明显升降。 |
| 本仓现状 | `native_audio/decode.rs` 用 `step = (src_rate / out_rate) * rate` 改变采样读取步进；这等同磁带变速，会同时改变速度和音高。ADR-0008 第一版明确“不做不变调变速”。 |
| 成功标准 | 非 1.0x 播放不再通过采样步进直接变调；实现有单元测试证明 1.5x 输出长度约为输入的 2/3，且主频保持在原频附近。 |

## 2. 业内成熟路线

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | WSOLA / SOLA | SoundTouch、audiotsm、`@audio/stretch-wsola` | 时域切窗，按目标速度移动分析窗，寻找相似波形位置再 overlap-add；适合语音、低延迟。 | [audiotsm WSOLA](https://audiotsm.readthedocs.io/en/latest/tsm.html)、[@audio/stretch](https://npm.io/package/%40audio/stretch) |
| B | Phase Vocoder | librosa、audiotsm | 频域 STFT 相位重建；泛化更好，但延迟、CPU 与实现复杂度更高。 | [librosa time_stretch](https://librosa.org/doc/latest/generated/librosa.effects.time_stretch.html) |
| C | SoundTouch / Rubber Band native lib | SoundTouchJS、Rubber Band | 成熟 C/C++ DSP 库，质量更好；但 Windows/macOS 打包、签名、动态库分发成本高。 | [SoundTouchJS worklet](https://www.npmjs.com/package/%40soundtouchjs/audio-worklet) |

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| WSOLA / SOLA | 高 | 现有 `native_audio/decode.rs` 已有流式 PCM 与 ring buffer，可在 producer 前插入 tempo 层 | 质量不如 Rubber Band；极端 0.25x/3x 会有伪影 | 纯 Rust，可测，低打包风险 |
| Phase Vocoder | 中 | 可作为后续高质量模式 | 需 FFT 依赖、窗口状态、相位连续；实时延迟更高 | 中等复杂 |
| SoundTouch / Rubber Band | 低 | 算法成熟 | 跨平台 native 库、许可证、打包签名复杂 | 不适合当前小薄片 |

**本仓已有可复用模块**：

- `apps/desktop/src-tauri/src/native_audio/decode.rs`：Symphonia 解码与 producer。
- `apps/desktop/src-tauri/src/native_audio/output.rs`：CPAL 输出回调。
- `apps/desktop/src-tauri/src/native_audio/clock.rs`：倍速与播放位置真源。
- `apps/desktop/src/services/waveform/transport/nativeAudioPlaybackTransport.ts`：前端显示钟，仅消费 rate，不做音频 DSP。

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 纯 Rust SOLA/WSOLA 风格 tempo 层；1.0x 走旧线性重采样；非 1.0x 按多声道 frame 同步处理，保留 stereo 差异。 |
| 不做什么 | 不引入 C/C++ native 库；不恢复 WebAudio/MediaElement；不做输出设备选择 UI；不承诺音乐级无伪影。 |
| 与 ADR / architecture 关系 | 修订 ADR-0008 “第一版不做”的历史限制；播放真源仍是 CPAL + Symphonia。 |
| 风险与 spike 项 | 低倍速延迟与 CPU；仍需真实中文人声手听，音乐级质量不承诺。 |

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | `native_audio/tempo.rs` | 新增 tempo processor 与测试 |
| Rust | `native_audio/decode.rs` | 非 1.0x 走 tempo processor |
| 文档 | ADR-0008 / waveform architecture | 更新当前能力边界 |
| 测试 | `cargo test native_audio` | 长度与主频测试 |

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户选择产品级修复

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 初版：选择纯 Rust WSOLA/SOLA 路线，避免 native 库打包风险。 |
| 2026-07-19 | P1：tempo 层改为多声道 frame 同步处理；解码侧不再强制 downmix mono。 |
| 2026-07-19 | 加固：设备重建重建 tempo；1.0x 边界 reset；快进按 rate 提高拉取目标并跳过饿缓冲 sleep。 |
