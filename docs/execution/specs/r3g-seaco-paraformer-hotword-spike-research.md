# 调研：R3g-SeACo — SeACo-Paraformer 热词 Spike

> **状态**：⏸ **Defer**（2026-06-11）· 实测见 [results](./r3g-seaco-paraformer-hotword-spike-results.md)  
> **手测**：[r3g-seaco-paraformer-hotword-spike-hand-test-checklist.md](./r3g-seaco-paraformer-hotword-spike-hand-test-checklist.md)  
> **关联**：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) · [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) · ACC-EVAL-1 / ASR-VOC-5  
> **门禁**：**不得**改 `LOCAL_ASR_MODEL_CATALOG` / 用户下拉，直至 Go 签收

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 禅修/制控类长课音频，术语表已勾选「纳入热词」；专名（制控、禅堂、觉观、经行）仍可能听错或未出现在假设中 |
| **本仓现状** | Catalog 仅 **Paraformer-long-vad-punc**；热词经 `hotword=` 空格串传入 `generate()`（[`asr_model_profile.py`](../../../services/asr/rushi_asr/asr_model_profile.py)）；D3 金标对照 Paraformer **term_hit 3/4**（漏「经行」），CER **0.214** |
| **Spike 成功标准** | env-only 侧车跑通 SeACo SKU，在同一 manifest 样本上 **term_hit / CER / hotwords on-off lift** 可量化；产出 **Go / Defer / No-go** |

**非目标**

- 不改桌面 catalog、不替换 R3s-A 默认 Sherpa Qwen3 路线  
- 不接 Sherpa ONNX 热词（ADR-0006 No）  
- 不 bump 侧车 lock / 不 PyInstaller 打包（Defer 到 Go 后）

---

## 2. 业内路线（≥2）

| # | 路线 | 代表 | 热词机制 | 链接 |
|---|------|------|----------|------|
| A | **SeACo-Paraformer** | `iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch` | bias encoder/decoder + ASF；论文 recall **60–87%** vs CLAS **51–69%** | [ModelScope](https://modelscope.cn/models/iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch) · [arXiv:2308.03266](https://arxiv.org/abs/2308.03266) |
| B | **Paraformer-large-vad-punc（现状）** | `iic/speech_paraformer-large-vad-punc_*` | 通用 `hotword=` 偏置；本仓已接线 | R3g-A ✅ |
| C | **Fun-ASR-Nano** | Fun-ASR-Nano-2512 | README `hotwords=[...]`；LLM-ASR | [landscape §①](./asr-landscape-top4-research-2026-06.md) **Defer** |

---

## 3. 可复用评估

| 路线 | 复用度 | 与 Rushi 对齐 | 冲突 / 风险 |
|------|--------|---------------|-------------|
| **A SeACo + FunASR** | **高** | `recognizer` 含 `paraformer` → 现有 VAD/punc/sentence_timestamp 路径；`eval-run.py` + D3 manifest 可直接 A/B | 权重 **另下**（~220M+）；与 Paraformer 并存占磁盘；SeACo 延迟略高于裸 Paraformer |
| **B 维持现状** | **高** | 全链路签收 | 热词为 L0 弱偏置；D3 已漏专名 |
| **C Nano** | 中 | 同侧车栈 | lock 分叉、更重；非 Paraformer 热词专项 |

**须复用**：`segmentation.py`、`eval-run.py`、`fixtures/eval/eval_manifest.v1.json`（`d3-tang32-zhikong-gaijiang`）；**禁止** fork 第二套分段内核。

---

## 4. 决策（spike 前）

**假设**：SeACo 在 **同热词串** 下 term_hit 优于现状 Paraformer，且 CER 不劣化超过 **+0.02** → **Go 候选**（第二 FunASR SKU / 专名增强轨，非默认替换）。

**不做什么**

- spike 内不把 SeACo 设为默认或写进 catalog  
- 不以 Sherpa Qwen3 无热词为由单独 Go SeACo（产品默认仍 R3s-A）

---

## 5. Spike 指标（签收表）

| ID | 指标 | Baseline（Paraformer + 热词 on） | SeACo 门槛 |
|----|------|----------------------------------|------------|
| G1 | 链路 | D3 跑通，`segment_count ≥ 50`，`segmentation_mode=sentence_info` | 同等 |
| G2 | **term_hit_rate** | D3 实测 **0.75**（3/4） | **≥ baseline**；理想 **1.0**（4/4） |
| G3 | **cer_chars** | D3 实测 **~0.214** | **≤ baseline + 0.02** |
| G4 | **hotwords lift** | on/off 可观测（manifest `hotwords_ab`） | on **>** off（term_hit 或专名子集） |
| G5 | warnings | 无 `hotword_param_unsupported` | 同等 |
| G6 | RTFx | 记录 wall；不硬门禁 | 记录；若 **< baseline × 0.7** 记 Defer 风险 |

**Go / Defer / No-go**

- **Go**：G1–G5 全过，且 G2 严格优于 baseline  
- **Defer**：G2 略优但 G6 过慢或 prepare/切换 SKU  fragile  
- **No-go**：G2 不优或 G3 超阈或 G1 失败

---

## 6. 参考

- FunASR SeACo demo：`examples/industrial_data_pretraining/seaco_paraformer/demo.py`  
- 本仓 eval：`npm run eval:run:long-form` · `npm run eval:run:hotwords-ab`  
- D3 金标：`fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt`
