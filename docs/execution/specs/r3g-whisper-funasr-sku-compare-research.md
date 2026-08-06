# 调研：FunASR 内嵌 Whisper 同音频对照（Phase 0）

> **状态**：**No-go**（2026-07-28）· 实测见 [`r3g-whisper-funasr-sku-compare-results.md`](./r3g-whisper-funasr-sku-compare-results.md)  
> **关联路线图**：路径 A（同 FunASR 栈挂 Whisper SKU）；非发行阻塞  
> **关联 spec**：[`r3g-whisper-funasr-sku-compare-results.md`](./r3g-whisper-funasr-sku-compare-results.md)  
> **门禁**：未完成本对照 **不得** 改 `LOCAL_ASR_MODEL_CATALOG` / sidecar lock / 默认 Paraformer  
> **计划真源**：Cursor plan `Whisper FunASR compare`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 决策「路径 A」是否值得做：同课录音上 FunASR 内嵌 Whisper 相对现有 Paraformer 的精度、断句、标点、墙钟 |
| **本仓现状** | Catalog 仅 Paraformer（[`model_catalog.py`](../../../services/asr/rushi_asr/model_catalog.py)）；推理硬绑 `funasr_engine`；分段真源 [`segmentation.py`](../../../services/asr/rushi_asr/segmentation.py)；评测 [`eval_metrics.py`](../../../services/asr/rushi_asr/eval_metrics.py) + [`fixtures/eval`](../../../fixtures/eval/) |
| **成功标准** | 可复现对照表 + `Go / Defer / No-go`；Whisper 长音频 `<10` 段或整轨占位 → **No-go**（与 Qwen/Nano 同纪律） |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **FunASR AutoModel 内嵌 Whisper** | `Whisper-large-v3-turbo` + fsmn-vad ± ct-punc | 同栈 `generate()`；官方 demo 用 `DecodingOptions` + `batch_size_s=0` | [FunASR whisper demo](https://github.com/modelscope/FunASR/blob/main/examples/industrial_data_pretraining/whisper/demo.py)、[FunASR Benchmark](https://modelscope.github.io/FunASR/benchmark.html) |
| B | **独立 faster-whisper / openai-whisper 引擎** | CTranslate2 / OpenAI | 第二推理栈；需另建分段适配 | 本仓 remediation plan **明确不采纳**（Phase 0） |
| C | **维持 Paraformer only** | 本仓默认 SKU | VAD + ct-punc → `sentence_info` | ADR-0003 |

公开长音频中文 CER（FunASR 官方 2026）：Paraformer-Large **10.18%** vs Whisper-large-v3 **20.02%** — 精度预期 Whisper 劣，本对照验证本仓课录音形态与**断句契约**。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 内存 / 进度 |
|------|--------|----------|-------------------|-------------|
| **A FunASR+Whisper** | **高** | `segmentation.py`、`eval_metrics`、`transcribe_upload`（Paraformer 基线）、fsmn-vad / ct-punc 缓存 | 需 `openai-whisper`；产品路径尚无 `DecodingOptions` / Whisper `cache_spec` | turbo ~800M–1.5GB；与 Paraformer 互斥加载 |
| **B 独立引擎** | 低 | — | 第二套真源；ADR / remediation 否决 | 另增体积 |
| **C 维持 Paraformer** | 高 | 全链路 | 无 Whisper 多语选项 | 已知 |

**本仓必须先复用**

- [`segmentation.segment_funasr_generate_result`](../../../services/asr/rushi_asr/segmentation.py) — 禁止 fork 第二套分段
- [`eval_metrics`](../../../services/asr/rushi_asr/eval_metrics.py)：`cer_chars` / `content_cer_chars` / `term_hit_rate` / `rtfx`
- [`engine.transcribe_upload`](../../../services/asr/rushi_asr/engine.py) — Paraformer 产品基线
- [`defaults.py`](../../../services/asr/rushi_asr/defaults.py) VAD / punc hub id
- 脚本形态：[`scripts/r3g-b-qwen3-spike-run.py`](../../../scripts/r3g-b-qwen3-spike-run.py)

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | Phase 0：同音频对照脚本；Paraformer 走产品 `transcribe_upload`；Whisper 走 FunASR `AutoModel` 直调（±ct-punc），再喂入现有分段内核 |
| **不做什么** | 不上 catalog；不改 sidecar lock / PyInstaller；不引入 faster-whisper / whisper.cpp；不改默认推荐 |
| **与 ADR** | ADR-0003 FunASR-first 一致（仍在 FunASR 栈内）；产品双引擎另议 |
| **风险** | 长音频无时间戳 → 0 段（Qwen/Nano 同类）；CPU 墙钟可能远高于 Paraformer；中文 CER 预期更差 |

### 对照矩阵（锁定）

| run_id | 加载 | 标点 |
|--------|------|------|
| `paraformer_product` | `transcribe_upload` | 产品 ct-punc |
| `whisper_turbo_vad` | AutoModel + fsmn-vad | 无 |
| `whisper_turbo_vad_punc` | 同上 + ct-punc | ct-punc |

默认不跑 `Whisper-large-v3`（`--include-large` 可选）。

### 闸门

| ID | 标准 |
|----|------|
| W1 | 短音频任一 Whisper 行 ≥1 段 |
| W2 | 长样本 Whisper **至少一行** `segment_count ≥ 10` 且非 whole-track |
| W3 | 长样本 `content_cer` 记数；分段双失败 → No-go |
| W4 | Whisper 长样本 wall ≤ **2×** Paraformer → 可谈产品，否则 Defer |

- **Go（进 Phase 1）**：W1+W2  
- **Defer**：分段勉强 / wall>2× / 标点仅靠二次后处理  
- **No-go**：W2 失败  

---

## 5. 落位预告

| 层 | 文件 | Phase 0 | Phase 1（仅 Go 后） |
|----|------|---------|---------------------|
| Docs | `r3g-whisper-funasr-sku-compare-research.md` / `…-results.md` | 写 | 填结论 |
| Scripts | `scripts/r3g-whisper-funasr-compare-run.py` + hand-test.sh | 写 | — |
| Python | `funasr_pipeline` / `asr_model_profile` / `model_prepare_cache` / `funasr_engine_infer` | **不改** | 适配 Whisper family |
| UI / catalog | — | **不改** | 另决策 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 对照脚本跑通（30s 短对照 + D3 长样本；`--skip-term`）
- [x] results 填 **No-go**（W2 失败）
- [x] **不进入** Phase 1 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-28 | 初版 |
| 2026-07-28 | 实测签收 No-go：Whisper 无可用语段；content_cer≈0.31 vs Paraformer≈0.14；wall≈7× |
