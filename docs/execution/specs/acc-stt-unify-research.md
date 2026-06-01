# ACC-STT-UNIFY 调研：术语表 → 本机 + 在线 STT 统一偏置

> **状态**：已采纳（2026-05-31）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤h**  
> **关联验收**：[`acc-stt-unify-acceptance.md`](./acc-stt-unify-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 只维护一套「术语库」；本机与在线转写都应尽量带上专名偏置 |
| **本仓现状** | `glossary_terms` → `build_glossary_hotwords`；本机 `POST /v1/transcribe` 的 `hotwords`；Rust 已有 `SttVocabularyPlan` + OpenAI/AssemblyAI/Deepgram adapter |
| **成功标准** | 三家在线 v1 必接；不支持厂商有 `online_vocabulary_unsupported`；环境页可观测「谁支持术语偏置」 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | **Phrase list / prompt** | Azure phrase list、OpenAI transcription `prompt` | 文本提示或短语表，字段各异 |
| B | **Keyterms / keywords** | AssemblyAI `keyterms_prompt`、Deepgram `keywords` | 数组或 query 参数 |
| C | **统一 hotword 字段** | 部分自建网关、FunASR `hotword=` | 单一 HTTP 字段；**不**适用于 OpenAI/AssemblyAI 原生 API |

---

## 3. 决策

| 问题 | 结论 |
|------|------|
| **选定方案** | 单真源 `glossary_terms` → `SttVocabularyPlan` → **per-channel adapter**（Rust）+ TS **能力矩阵**（U2） |
| **v1 必接** | OpenAI、AssemblyAI、Deepgram + 自定义代理 `hotwords` |
| **v1 不做** | Azure/百炼 `vocabulary_id`、U4 自动回落本机、U3 三盏灯（→ R3h-3） |
| **真源** | [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) |

---

## 4. 落位

| 层 | 文件 |
|----|------|
| Rust | `stt_vocabulary.rs`、`run_transcribe_cmd.rs`、`transcribe_native_online.rs`、`stt_native/deepgram.rs` |
| TS | `sttVocabularyBias.ts`、`sttOnlineProviderContract`、`EnvOnlineSttPanel`、`asrTranscribeHints.ts` |

---

## 5. 签收

- [x] 调研 brief
- [x] acceptance 链接本文
