# 调研：Native Audio 引入 Signalsmith Stretch

> **状态**：已进入实现（2026-07-19）  
> **关联 ADR**：[ADR-0008](../../adr/0008-native-audio-playback-transport.md)  
> **关联现状**：[native-audio-pitch-preserving-rate-research.md](./native-audio-pitch-preserving-rate-research.md)  
> **门禁**：本文只评估替换/升级 tempo processor；不改 Transport Authority、播放 UI、ASR、波形渲染。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 听写校对常用 0.75x、1.25x、1.5x；慢速需要保留人声自然度，不能出现中段嘶哑、沙沙感或明显拼接痕迹。 |
| 本仓现状 | `apps/desktop/src-tauri/src/native_audio/tempo.rs` 是轻量 SOLA/WSOLA 风格实现，已解决“变速变调”和多声道保留，但慢速时仍可能暴露拼接伪影。 |
| 成功标准 | 0.75x / 0.8x 中文人声连续播放 10 分钟无明显嘶哑；切换速度后 200ms 内听感进入新档；native audio 定向测试通过。 |

---

## 2. 业内成熟路线

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 继续自研 SOLA/WSOLA | 当前 `native_audio/tempo.rs`、SoundTouch 类实现 | 时域切窗 + 相似点搜索 + overlap-add；低延迟、易嵌入，但慢速人声伪影需要长期调参。 | [SoundTouch](https://www.surina.net/soundtouch/) |
| B | 引入 Signalsmith Stretch | Signalsmith Stretch | C++11 header-only 的 pitch/time stretch；官方推荐中等 time-stretch 变化，适配 0.75x-1.5x 校对档位。 | [Signalsmith Stretch](https://signalsmith-audio.co.uk/code/stretch/) |
| C | 引入 Rubber Band | Rubber Band Library | 成熟高质量 time-stretch / pitch-shift；质量强，但授权与动态库分发成本更高。 | [Rubber Band](https://breakfastquay.com/rubberband/) |

---

## 3. Signalsmith 复用评估

| 维度 | 结论 |
|------|------|
| 授权 | MIT；比 Rubber Band 的 GPL/商业授权路径更低摩擦。官方代码页列为 open-source，Stretch 项目页标注 MIT licensed。 |
| 集成形态 | C++11 header-only；不需要运行时动态库。Rust 侧可用 `cc` 编译一个很薄的 C ABI wrapper。 |
| 算法边界 | 官方说明 time-stretch 在 0.75x 到 1.5x 这类 modest changes 上效果最好；这正好覆盖 Rushi 听写主档。0.25x / 3x 仍不应承诺无伪影。 |
| 延迟模型 | 官方暴露 `inputLatency()` / `outputLatency()`；调用方要按延迟喂入与取出，速度自动化也要按处理时间对齐。Rushi 需要把这部分纳入切速响应设计。 |
| 实时 CPU | 官方提示未优化构建会明显慢；Tauri release 构建没问题，debug 下可能需要单独给 wrapper 开优化。 |
| 跨平台 | Windows/macOS 都有 C++ toolchain 成本；但 header-only + 静态编译比动态库分发简单。CI 需覆盖 Windows MSVC 与 macOS Clang。 |

**本仓已有可复用模块**：

- `apps/desktop/src-tauri/src/native_audio/decode.rs`：已有流式 PCM → producer 链路，可把当前 tempo processor 替换成统一接口。
- `apps/desktop/src-tauri/src/native_audio/clock.rs`：已有 `rate_milli` / `rate_seq`，可继续作为速度真源与切速重置通知。
- `apps/desktop/src-tauri/src/native_audio/output.rs`：ring buffer 与 drain 机制已能清旧速度 PCM。
- `apps/desktop/src-tauri/src/native_audio/tempo.rs`：可保留为 fallback / 对照测试基线。

---

## 4. 方案建议

| 问题 | 结论 |
|------|------|
| 是否值得上 | 值得进入 spike。Signalsmith 正好命中“中文听写中等变速 + 本地桌面 + 低授权摩擦”的约束，比继续自研慢速拼接更稳。 |
| 推荐接入方式 | 新增 `native_audio/stretch/` 抽象层：Rust trait `TempoProcessor`，当前 Rust SOLA 与 Signalsmith wrapper 共用同一接口；先用编译期开关或内部常量灰度。 |
| 默认档位 | 优先让 0.75x、0.8x、1.25x、1.5x 走 Signalsmith；1.0x 保持直通；极端 0.25x / 3.0x 标记为 best effort。 |
| 切速响应 | 不把切速做成 seek；沿用 `rate_seq` 清 ring buffer，并调用 Signalsmith `reset()` 或等价 seek/flush 策略，确保旧速度残留不继续播放。 |
| 不做什么 | 不引入动态库分发；不承诺音乐制作级质量；不把它用于 ASR 前处理；不改 UI。 |

---

## 4.1 速度档位与交互评估（2026-07-19）

| 问题 | 评估 |
|------|------|
| 为什么补 0.75x | 中文校对慢听通常需要“略慢但仍自然”的主档；0.5x 太慢、0.25x 只适合极端听辨。0.75x 应成为慢速首选档，而不是隐藏在极端慢速之间。 |
| 是否补 0.8x | 暂不同时补。0.75x 与 0.8x 过近，会让当前上下展开菜单变密；Signalsmith spike 通过后可再根据手听决定是否保留双档。 |
| 交互反馈路线 | 不加 toast / 弹窗；速度按钮本身在选择后进入短暂 pending 外观，表示命令已受理。实际音频响应由 `rate_seq` 清旧 ring buffer 保障。 |
| 设计理由 | 工具条是高频校对控件，反馈必须局部、短促、不中断文本编辑；按钮轻背景 + 细进度线符合 Notion Zen 的克制工作台风格。 |
| 完成边界 | UI 只表达“已受理”，不承诺 DSP 已完全稳定；底层音质仍由当前 WSOLA 修补与后续 Signalsmith spike 解决。 |

---

## 5. Spike 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust build | `apps/desktop/src-tauri/build.rs` / `Cargo.toml` | 增加 `cc` build-dependency；编译 C++ wrapper。 |
| Rust native | `apps/desktop/src-tauri/src/native_audio/tempo.rs` | 抽出 `TempoProcessor` 接口；保留 Rust fallback。 |
| Rust FFI | `apps/desktop/src-tauri/src/native_audio/signalsmith_tempo.rs` + wrapper header/cpp | 封装 interleaved PCM、rate、reset、latency、process。 |
| Decode | `apps/desktop/src-tauri/src/native_audio/decode.rs` | 替换非 1.0x tempo processor；处理 input/output latency 与切速 reset。 |
| 测试 | `cargo test native_audio` + fixture smoke | 保持主频测试；新增慢速连续性/无 NaN/多声道测试。 |

---

## 6. 验证计划

| 类别 | 方法 | 通过标准 |
|------|------|----------|
| 自动化 | 440Hz sine：0.75x / 1.5x 输出长度与主频 | 长度误差在既有阈值内；主频不向 naive resampling 方向漂移。 |
| 自动化 | stereo fixture | 左右声道不塌缩。 |
| 自动化 | rate switch smoke | 切速后 `rate_seq` 重置 processor，旧 ring drain 不再输出旧档。 |
| 手测 | 中文长音频 0.75x / 0.8x | 连续 3-5 分钟无中段嘶哑、机械沙感明显降低。 |
| 手测 | 播放中 0.75x ↔ 1.25x ↔ 1.0x | 新速度听感 200ms 内生效，无长时间旧档残留。 |

---

## 7. 风险

- **FFI 边界**：Rust interleaved buffer 与 Signalsmith channel-major API 需要薄适配，避免每帧大量分配。
- **延迟补偿**：Signalsmith 有输入/输出 latency，UI authority clock 不能被 DSP latency 误导；优先保持当前播放时钟语义，只把 DSP latency 当作音频内部预读。
- **debug 性能**：官方提示无优化构建会慢，Windows debug 可能听到 underrun；wrapper 可单独打开优化或只用 release 做最终听感判断。
- **依赖归档**：建议 vendored header 固定 commit，并在 `third_party/` 保留 LICENSE，避免构建时联网。

---

## 8. 签收

- [x] 调研 brief 完成
- [ ] spike 验证完成
- [ ] ADR / architecture 在采纳后更新
- [ ] 用户确认进入实现

**资料来源**

- [Signalsmith Stretch 官方项目页](https://signalsmith-audio.co.uk/code/stretch/)
- [Signalsmith 开源代码与授权页](https://signalsmith-audio.co.uk/code/)
- [Signalsmith Stretch README](https://git.signalsmith-audio.co.uk/Signalsmith-Audio/signalsmith-stretch/src/branch/main/README.md)
- [Signalsmith Stretch examples](https://signalsmith-audio.co.uk/code/stretch/examples.html)

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 初版：建议进入 Signalsmith Stretch spike，作为慢速嘶哑问题的产品级替换方案。 |
| 2026-07-19 | 补充速度档位与交互评估：新增 0.75x；速度按钮选择后给局部 pending 反馈。 |
| 2026-07-19 | 实现：vendored Signalsmith Stretch / Linear MIT 头文件，新增 C ABI wrapper，native audio 非 1.0x 改走 Signalsmith。 |
