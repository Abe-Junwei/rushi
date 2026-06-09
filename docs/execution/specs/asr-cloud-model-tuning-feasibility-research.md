# 调研：阿里云百炼 / 其它云服务进行 ASR「模型调优」的可行性

> **状态**：已采纳（2026-06-09）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8.1 **ACC-STT-ALI**、§4.1.1 ⑤h **ACC-STT-UNIFY**  
> **关联架构**：[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)、[`stt-online-providers.md`](../../architecture/stt-online-providers.md)、[`r3-provider-configuration-research.md`](./r3-provider-configuration-research.md)  
> **门禁**：若进入「百炼热词 CRUD + 在线转写接入」编码，须另写 intent/acceptance 并链接本文；**ASR 权重微调**不在 v1/v2 桌面产品范围。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 法律/医疗/媒体等垂直领域，希望 ASR 对专名、术语、口音更准；有人会把需求表述为「模型调优 / 微调 / 定制模型」 |
| **本仓现状** | **本机**：FunASR 侧车 + `glossary_terms` → `hotwords`；**在线**：OpenAI / AssemblyAI / Deepgram + **百炼 Fun-ASR**（`dashscope-asr` + `vocabulary_id`，见 [`acc-stt-ali-acceptance.md`](./acc-stt-ali-acceptance.md)） |
| **成功标准（本调研）** | 分清「热词偏置 / 语言模型定制 / 权重微调」三类能力；给出在 Rushi 内**可落地**路径、成本与**明确不做**项 |

---

## 2. 业内成熟路线（≥4）

| # | 路线 | 代表 | 核心机制 | 是否「权重微调」 | 链接 |
|---|------|------|----------|------------------|------|
| **A** | **云 ASR 热词 / Phrase list** | 百炼 `speech-biasing`、Azure Phrase List | 解码偏置，**不**改模型权重；先 CRUD 词表得 `vocabulary_id`，转写时传入 | **否** | [百炼定制热词](https://help.aliyun.com/zh/model-studio/custom-hot-words/)、[Azure phrase list](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list) |
| **B** | **云 ASR 语言模型定制（LM adaptation）** | 阿里云智能语音 **ISI 自学习** | 上传**文本语料**训练 n-gram / LM，绑定 AppKey；提升专有名词，**非**端到端 ASR 权重训练 | **否**（LM 层） | [ISI 语言模型定制](https://help.aliyun.com/zh/isi/developer-reference/custom-models/) |
| **C** | **云 Custom Speech / 声学+语言联合训练** | Azure Custom Speech | 音频+人工转写或纯文本/结构化文本；训练自定义模型并部署**独占端点**；WER 评测闭环 | **是**（托管训练） | [Custom Speech overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-speech-overview) |
| **D** | **本机 FunASR 微调** | FunASR `train_ds.py` | JSONL（key/source/target）；GPU `torchrun`；产出 checkpoint 供推理加载 | **是**（自管） | [FunASR 训练与微调](https://modelscope.github.io/FunASR/zh/training.html) |
| **E** | **百炼大模型 SFT/CPT/DPO** | DashScope `/api/v1/fine-tunes` | 面向 **千问等文本生成模型**；与 ASR 无关 | **不适用 ASR** | [百炼模型调优](https://help.aliyun.com/zh/model-studio/fine-tuning-api-guide) |

### 2.1 百炼能力边界（关键结论）

| 能力 | 百炼 Model Studio | 说明 |
|------|-------------------|------|
| **LLM 微调（SFT/CPT/DPO）** | ✅ | 仅 **文本生成** 类模型（千问系列等） |
| **ASR 权重微调 / 上传 safetensor ASR** | ❌ | 文档与 API 均无 ASR 训练任务类型 |
| **ASR 热词（Fun-ASR / Paraformer 云 API）** | ✅ | `POST …/audio/asr/customization`，`model=speech-biasing`，需 `target_model` 与转写模型**严格一致** |
| **Qwen3-ASR 系列热词** | ❌ | 官方说明：**仅 Fun-ASR / Paraformer 支持热词**；当前 Rushi `dashscope-asr` 用的是 **qwen3-asr-flash**，与热词能力**不匹配** |

### 2.2 与本仓已有能力的对应关系

```text
用户术语库 (glossary_terms)
        │
        ├─► 本机 FunASR     hotwords 字符串 ──► generate(hotword=…)     ✅ 已落地
        ├─► OpenAI/AAI/DG   SttVocabularyPlan adapter                  ✅ ACC-STT-UNIFY
        ├─► 百炼 Fun/Para   vocabulary_id + target_model               ✅ ACC-STT-ALI（2026-06-09）
        ├─► 阿里 NLS        ISI 语言模型定制（AppKey 绑定）             ❌ 未接；另一产品面
        └─► 「模型权重微调」  FunASR train_ds / Azure Custom Speech      ❌ 无产品路径
```

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 成本 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A 百炼热词** | **高** | `glossary_terms`、`SttVocabularyPlan`、`sttVocabularyBias.ts` 能力矩阵；密钥分层与 `dashscope-asr` 同 Key | 须改用 **Fun-ASR / Paraformer 文件转写 API**（非当前 Qwen3 chat 路径）；`target_model` 与转写 model 一致；音频需上传云端（**隐私/合规**） | 实现量 **2–4d**；按 DashScope 语音识别计费；无训练等待 |
| **B ISI 语言模型定制** | **中** | 与现有 `aliyun-nls` 壳直连同生态；文本语料来自术语库/项目导出 | **控制台 + AppKey 绑定** 流程重；与百炼 DashScope Key **两套账号体系**；Rushi 未抽象「LM 模型 ID」 | 训练小时级；需用户在阿里云控制台维护 |
| **C Azure Custom Speech** | **中** | `azure-speech` adapter 已存在；可扩展 custom endpoint | 训练+托管端点**成本高**；数据上传；v1 路线图未排 | 训练 **天级**；独占端点月费 |
| **D 本机 FunASR 微调** | **低** | 侧车已是 FunASR；eval 管线有 hotwords A/B（`services/asr/tests`） | **桌面用户无 GPU 训练环境**；PyInstaller 侧车 **不含** `train_ds`；自定义 checkpoint **无** 一键分发/签名；违背「小白零终端」发行模型 | 需 **GPU 工作站 + 10–100h+ 标注音频**；与 R3h-3.5 Sherpa 路线并行时增加引擎矩阵爆炸风险 |
| **E 百炼 LLM SFT** | **无（ASR）** | 后处理 LLM 微调未来或可用 | **不能**提升 ASR 字错率 | — |

**本仓必须先复用的模块（禁止第二套术语真源）**：

- SQLite `glossary_terms` + `build_glossary_hotwords`（Rust）
- `SttVocabularyPlan` / `stt_vocabulary.rs`（在线偏置计划）
- `sttOnlineProviderContract` + `stt_native/*`（在线转写壳）
- 本机 `POST /v1/transcribe` + `funasr_engine.hotword=`（侧车）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **「百炼模型调优」若指 SFT/CPT** | **不可行用于 ASR**；仅适用于 LLM 后处理，且与转写准确率无关 |
| **「百炼 ASR 优化」若指热词** | **可行**，且与 Rushi 术语库方向一致；路线图已登记 **ACC-STT-ALI** |
| **若指 ISI 语言模型定制** | **可行但属另一产品线**（NLS + 控制台），适合企业用户；**不建议**与百炼 DashScope 混在同一 Provider 卡片里 |
| **若指权重微调（真·fine-tune）** | **百炼不提供**；本机 FunASR 微调**技术上可行、产品上不适合** Rushi 桌面 v1；Azure Custom Speech 适合**有标注数据的企业云部署**，非当前单机主路径 |
| **选定方案（推荐优先级）** | **P0**：ACC-STT-ALI — 百炼 Fun-ASR/Paraformer 文件转写 + `vocabulary_id` 同步；**P1**：文档区分「热词 vs 微调」，环境页能力矩阵补一行；**P2（可选）**：ISI LM 定制仅作 `aliyun-nls` 高级说明，不做通用向导 |
| **不做什么** | 在桌面壳内嵌 FunASR `train_ds`；调用百炼 `/fine-tunes` 冒充 ASR 调优；为 Qwen3-ASR-Flash 硬接 `speech-biasing`（官方不支持）；第二套 glossary 存储 |
| **与 ADR / architecture** | 符合 **ADR-0003 FunASR-first**（本机推理不变）；在线层扩展 **per-provider adapter**，不 fork 术语真源；对齐 [`acc-stt-unify-research.md`](./acc-stt-unify-research.md) §3 |
| **风险** | ① 用户混淆「热词」与「微调」预期 ② 云端转写 **音频出境** ③ `target_model` 不一致导致热词静默失效 ④ 双 API（Qwen3-Flash vs Fun-ASR）产品解释成本 |

---

## 5. 落位预告（若做 ACC-STT-ALI）

| 层 | 预计改动 |
|----|----------|
| **Rust** | `stt_native/dashscope_funasr.rs`（或扩展现有模块）：文件转写 API + `vocabulary_id`；`stt_vocabulary.rs` 增加 `DashScopeVocabulary` channel |
| **TS** | `sttVocabularyBias.ts` 标记 `dashscope-asr` / 新 id `dashscope-funasr` 支持热词；环境页 CRUD 或「同步术语到百炼词表」按钮 |
| **侧车** | **无**（云端推理） |
| **文档** | `stt-online-providers.md`、`asr-hotword-bias-truth.md` §3 矩阵 |

**Spike 验收（Go/No-go，≤1 天）**：

1. 用同一 API Key 创建 `target_model=fun-asr` 热词表，调用 Fun-ASR 文件转写 API，专名词 CER 对比（有/无 `vocabulary_id`）
2. 确认 Qwen3-ASR-Flash 路径 **不能** 复用热词（负例）
3. 评估 10MB/时长限制与 Rushi 长音频（R3e 窗循环）是否需 **异步文件转写 API**

---

## 6. 与「其它服务」对照（简表）

| 服务 | 热词/短语 | LM/文本定制 | 权重微调 | Rushi 已有 Provider |
|------|-----------|-------------|----------|---------------------|
| **阿里云百炼 DashScope** | Fun-ASR / Paraformer ✅ | — | ASR ❌ | `dashscope-asr`（Qwen3 only） |
| **阿里云 ISI / NLS** | 热词表 ✅ | 语言模型定制 ✅ | 非公开端到端微调 | `aliyun-nls` |
| **Azure Speech** | Phrase list ✅ | Custom Speech 文本 ✅ | Custom Speech 音频训练 ✅ | `azure-speech` |
| **OpenAI** | `prompt` ✅ | — | ASR ❌ | `openai` ✅ 术语已接 |
| **Deepgram / AssemblyAI** | keywords / keyterms ✅ | — | 企业定制 ❌/有限 | ✅ 术语已接 |
| **本机 FunASR** | `hotword=` ✅ | — | `train_ds.py` ✅（自管） | 侧车 ✅ |

---

## 7. 建议给产品 / 路线的表述

对用户说：

- **「在 Rushi 里提升专名识别」**：优先 **术语库 + 热词**（本机已支持；百炼/ Azure 短语表为在线扩展），**不是**重新训练模型。
- **「百炼模型调优」**：若指控制台「模型调优」菜单 → 那是 **LLM**，不作用于转写。
- **「真正微调 ASR 权重」**：需要 **标注音频数据集 + GPU 训练 + 模型部署**；Rushi 当前定位是 **消费** 模型而非 **训练** 平台；企业若必须，建议 **Azure Custom Speech 或离线 FunASR 训练管线**，产出模型后 **不在 v1 桌面安装包内自动分发**。

---

## 8. 签收

- [x] 问题陈述 + 本仓链路
- [x] 业内 ≥2 路线（A–E）
- [x] 可复用评估 + 决策 + 不做什么
- [x] 落位预告与 ACC-STT-ALI 对齐
