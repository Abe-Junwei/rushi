# 调研：桌面端「壳 + C++ ASR 管线」课代表如何避坑

> **状态**：已完成（2026-07-16）  
> **关联**：ADR-0006 / ADR-0007 · [r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md) · [r3h-3.5-sherpa-quant-compare-report.md](./r3h-3.5-sherpa-quant-compare-report.md) · [asr-landscape-top4-research-2026-06.md](./asr-landscape-top4-research-2026-06.md)  
> **触发**：评估「剪映 / 腾会钉钉 / Buzz / 政企私有化 = Sherpa 三驾马车已规模化」叙事  
> **门禁**：本文 **不授权** 解冻 ADR-0007 或改 catalog；仅校正课代表证据与可迁移避坑项

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 本机长音频转写要脱离 Python 宿主、控体积、硬化 VAD/标点/热词/线程 |
| **本仓现状** | FunASR 侧车默认；Sherpa Qwen/Paraformer 仅 spike；标点/热词/线程分锁未产品化 |
| **成功标准** | 厘清哪些产品 **真** 跑通「壳 + 原生推理 + VAD(+标点)」；哪些 **不能** 当 Sherpa/Qwen 证言；抽出可写进本仓 spike 规范的避坑项 |

---

## 2. 课代表核验（公开可验证信息）

| # | 叙事中的课代表 | 叙事主张 | 公开证据结论 | 能否证明「Sherpa + Qwen/SenseVoice + CT 标点」 |
|---|----------------|----------|--------------|-----------------------------------------------|
| **A** | 剪映 / CapCut 桌面「自动字幕」 | 断网 1h 视频 1 分钟出带标点字幕；C++ 侧车几百 MB | **Auto Captions 为云端 ASR，需联网**；离线编辑≠离线字幕。见 CapCut 指南 FAQ「no offline mode for auto captions」 | **否** — 证明不了本地 Sherpa 管线 |
| **B** | 腾讯会议 / 钉钉「本地实时字幕」 | 独立 C++ 侧车、线程锁死、流式标点 | 产品字幕/纪要公开路径为 **云端 ASR / 端云协同**（端侧多为降噪采集）；无公开「纯离线 Sherpa 三驾马车」文档 | **否** — 可学进程隔离与 CPU 预算，不可当引擎证言 |
| **C** | Buzz | 最早玩明白 Sherpa-ONNX；Silero→声学→标点；锁线程/Max Tokens | GitHub 真源：**Powered by OpenAI Whisper**；后端为 Whisper / whisper.cpp / faster-whisper；**不是 Sherpa-ONNX 标杆** | **部分** — 证明「桌面壳 + 原生 Whisper 后端 +（可选）VAD」可行；**不证明** Qwen/SenseVoice/CT-Transformer 闭环 |
| **D** | 百度/阿里政企私有化单兵包 | Tauri/Electron + C++；FST 热词 + 原版标点 | 交付物不公开；无法独立复现体积/CER/线程策略 | **不可证伪也不可采信为工程规格** |

### 2.1 更合适的「可对标」开源/桌面产品

| 产品 / 栈 | 壳 | 推理 | VAD | 标点 | 与 Rushi 可学点 |
|-----------|-----|------|-----|------|-----------------|
| **Buzz** | Python/Qt 类 GUI（非「全面 Tauri」叙事） | whisper.cpp / faster-whisper / OpenAI Whisper | 依赖后端；whisper.cpp 支持 Silero 系 VAD | Whisper 自带标点倾向；非独立 CT-Transformer 标配 | 多后端、用户可选模型体积、GPU/线程相关设置 |
| **MacWhisper** | 原生 Mac GUI | whisper.cpp + CoreML | 产品侧分段/会话策略（生态常见 Silero 预处理） | 模型内文本规整 + 可选云 LLM 润色 | **进程外推理、Apple 加速、模型 SKU 分级** |
| **whisper.cpp** | CLI / 被 GUI 嵌入 | 纯 C/C++ | `--vad` + max speech duration 等 | 模型内；无强制 CT 外挂 | **VAD 硬切、量化、线程/后端显式配置** |
| **CrossSubtitle-AI** | **Tauri v2** | whisper-rs | ort + Silero ONNX | 翻译走 API；ASR 本地 | **与本仓壳最像**：Tauri + Rust 编排 + Silero + 原生 Whisper |

链接：

- CapCut offline captions：[capcutguide.com/capcut-auto-captions](https://capcutguide.com/capcut-auto-captions/)  
- Buzz：[github.com/chidiwilliams/buzz](https://github.com/chidiwilliams/buzz)  
- whisper.cpp VAD：[ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp)  
- CrossSubtitle-AI：[github.com/AndySkaura/crosssubtitle-ai](https://github.com/AndySkaura/crosssubtitle-ai)  
- 腾讯会议字幕（云能力文档）：[腾讯云 会议字幕](https://cloud.tencent.com/document/product/1095/80884)

---

## 3. 可复用评估（避坑手法，不绑定虚假证言）

| 避坑主题 | 业内真实常见做法（可验证栈） | 叙事中的「剪映/腾会证言」 | 本仓复用度 | 冲突 / 缺口 |
|----------|------------------------------|---------------------------|------------|-------------|
| **长音频切窗** | whisper.cpp / Silero：先 VAD，再只喂语音段；`max_speech_duration` 硬上限 | 归因剪映本地管线 | **高** | 本仓 FunASR 已 `max_single_segment_time`；Sherpa P2 已有 VAD，默认 30s 可下调至 20s |
| **防复读 / 幻觉** | VAD 阈值上调；限制上下文；Whisper 系抑制无语音段；部分产品限制生成长度 | 归因 Buzz「Max Tokens」 | **中高** | Qwen 自回归更敏感；须在 sherpa_qwen3 spike 参数矩阵测 |
| **线程 / UI 不卡** | 推理后台线程；线程数 ≤ 核数；Mac 上 CoreML/ANE | 归因腾会「锁 2+1 核」 | **高** | 本仓侧车已进程隔离；Sherpa 内嵌须分组件 `num_threads` |
| **标点** | Whisper 常「模型内标点」；独立 CT-Transformer 是 **Sherpa/FunASR 生态选项**，非剪映公开配方 | 「所有课代表都挂 279MB CT」 | **中** | 外挂 CT + 滑窗对本仓有价值，但 **不能** 用剪映证明已规模化 |
| **热词** | 云会议用云热词；本地 Whisper **无** FunASR Predictor / transducer FST 等价物；后处理/LLM 润色常见 | 「政企 FST 百分百」 | **低～中** | sherpa-onnx 官方 FST **仅 transducer**；Qwen/SenseVoice 不得照搬 |
| **体积** | 小模型 + 量化 + 按需下载大模型；不是「固定 350MB 含 CT」 | 剪映几百 MB 本地 ASR | **中** | CapCut 字幕云端 → 体积叙事不成立；本仓须按组件实测 |
| **进程隔离** | 子进程 / 侧车 / 崩溃可拉起 | 与叙事一致且本仓已有 | **高（已落地）** | 保持 `8741` 或未来 `asr_sherpa` 隔离；主壳不链死推理 |

**本仓已有可复用模块（禁止 fork 第二套）**

- 侧车进程隔离：`services/asr` + `asr_sidecar` / loopback  
- VAD 长音频：`segmentation.py`、FunASR `RUSHI_FUNASR_VAD_MAX_MS`  
- Sherpa harness：`spike/sherpa_qwen3`、`spike/sherpa_paraformer`（含 Silero P2）  
- 热词词表：`glossary_hotwords`（产品层）≠ Sherpa FST  
- LRC / catalog：引擎无关分发

---

## 4. 决策

| 问题 | 结论 |
|------|------|
| 叙事是否证明「Sherpa 三驾马车已是商业标配」？ | **否**。剪映字幕云端；会议字幕主路径云端；Buzz 是 Whisper 系；政企不可验证。 |
| 是否仍值得做「管线硬化」spike？ | **是** — 依据是 **whisper.cpp / MacWhisper / CrossSubtitle / 本仓 P0–P2 痛点**，不是剪映证言。 |
| 应对齐的真实范式 | **壳（Tauri）+ 原生推理（C++/Rust 绑定）+ Silero-VAD 硬切 + 显式线程预算 + 模型分 SKU/按需下载**；标点外挂是 **可选增强**，不是课代表共性。 |
| **不做什么** | 不以剪映/腾会为 ADR-0007 Active 证据；不把 Buzz 写成 Sherpa 标杆；不假设 FST 热词适用于 Qwen/SenseVoice；不承诺 350MB 含 CT 通发。 |
| 与 ADR | 维持 ADR-0007 **proposed + Defer**；硬化项进 spike/acceptance 附录，过金标后再谈默认切换 |

### 本仓 Takeaway（校正版）

1. **进程隔离**：本仓已对齐；继续侧车/子进程，主壳只发请求。  
2. **参数硬化**：从 **whisper.cpp / 本仓 P2** 抄作业（20s 硬切、threshold、threads），不是从剪映。  
3. **声学选型**：开源桌面「课代表」主流是 **Whisper 族**，不是 Qwen3；中文长音频本仓仍以 Paraformer 签收为准，Sherpa Qwen 需金标。  
4. **标点**：独立 CT-Transformer 是 Sherpa 生态成熟件，值得 spike；**不是**剪映公开配方。  
5. **热词**：产品层 glossary + 云热词 vs 本地 FST 分轨验证；禁止统一「score=5.0」神话。

---

## 5. 落位预告（若开 ≤1 周硬化 spike）

| 层 | 改动 | 说明 |
|----|------|------|
| Spike only | `spike/sherpa_qwen3` / `sherpa_paraformer` | threshold / max_speech=20 / threads 分锁 / max tokens；**不**接 `run_transcribe_cmd` |
| Spike only | 可选 `OfflinePunctuation` + 300 字滑窗 | 体积单独记账 |
| Docs | 本 brief + acceptance 附录 | 引用真实对标表 §2.1 |
| 禁止 | catalog / 默认引擎 / 「取消 CDN」叙事 | 直至 G1 金标 |

**验证（spike）**：制控 30s/780s；RTF、语段数、交叉 CER、复读率、UI 卡顿主观；线程数抓取（Activity Monitor / 任务管理器）。

---

## 6. 签收

- [x] 课代表主张已用公开来源核验（2026-07-16）  
- [ ] 用户确认：硬化 spike 范围（仅 Qwen / 含 Paraformer P2 / 含标点）  
- [ ] 金标集就绪前不 Active ADR-0007  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 初版：否定剪映/腾会作为本地 Sherpa 证言；校正 Buzz；给出可迁移避坑与真实对标 |
