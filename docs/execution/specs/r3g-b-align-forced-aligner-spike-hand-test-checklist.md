# R3g-B-Align 手测清单 — Qwen3 + ForcedAligner

> **Research**：[`r3g-b-align-qwen3-forced-aligner-spike-research.md`](./r3g-b-align-qwen3-forced-aligner-spike-research.md)  
> **Results**：[`r3g-b-align-forced-aligner-spike-results.md`](./r3g-b-align-forced-aligner-spike-results.md)  
> **脚本**：`bash scripts/r3g-b-align-forced-aligner-spike-hand-test.sh`

## Phase 0 — 环境

```bash
export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B
RUSHI_ASR_DEV_RESTART=1 npm run asr:dev
```

- [ ] `bash scripts/r3g-b-align-preflight.sh` → `PASS`（含 `funasr_load_plan.uses_local_paths: true`）

- [ ] `funasr>=1.3.3`、`qwen-asr` 已装（`services/asr/.venv`）
- [ ] `POST /v1/models/prepare-default` 完成（会下载 Qwen ASR + VAD + **ForcedAligner**）
- [ ] `/health` → `ready_for_transcribe: true`、`funasr_required_models_cached: true`
- [ ] `/health` → `funasr_forced_aligner_cached: true`（`funasr_forced_aligner_model_id` 为 `Qwen/Qwen3-ForcedAligner-0.6B`）

## Phase 1 — 长样本（制控）

```bash
bash scripts/r3g-b-align-forced-aligner-spike-hand-test.sh
# 或
npm run eval:run:long-form -- --output docs/execution/spike-output/qwen3-align-YYYY-MM-DD/eval-report.json
```

| # | 指标 | Paraformer 基线 | Qwen+Aligner 要求 | 实测 | 通过 |
|---|------|-----------------|-------------------|------|------|
| A1 | `segment_count` | 197–198 | ≥10 | | |
| A2 | vs baseline | 197 | ≥177 或 Defer 书面说明 | | |
| A4 | `segmentation_mode` | sentence_info | 非 empty / 非 long_audio_no_segments | | |
| A5 | `term_hit_rate` | 0.0–1.0 | ≥ baseline | | |
| A8 | `wall_sec` | ~168s | ≤2× Paraformer (~336s) Go | | |

## Phase 2 — 短样本（可选）

- [ ] `clear.wav` ≥1 段或记录「仅长音频 SKU」Defer

## 签收

- [ ] §4.1 表填 [`spike-results`](./r3g-b-align-forced-aligner-spike-results.md)
- [ ] 结论：**Go / Defer / No-go**
