# ACC-EVAL-2 手测清单 — 长音频指标（segment_count · RTFx）

> **状态**：✅ 手测签收（2026-06-11）  
> **Intent**：[`acc-eval-2-long-form-metrics-intent.md`](./acc-eval-2-long-form-metrics-intent.md)  
> **命令**：`npm run eval:run:long-form`

## 环境

- [x] `curl -sf http://127.0.0.1:8741/health` → `ready_for_transcribe: true`
- [x] 本机活跃 SKU：**Paraformer 长音频**（`paraformer-long-vad-punc`）
- [x] 样例：`fixtures/eval/samples/制控.mp3` 存在

## 执行

```bash
npm run eval:run:long-form
```

等价：

```bash
python3 scripts/eval-run.py --filter-id proper-noun-zhikong --assert-min-segments
```

## 结果（2026-06-11 · BaideMac）

| 字段 | 实测 | Intent 要求 | 通过 |
|------|------|-------------|------|
| `exit_code` | 0 | 0 | ✅ |
| `segment_count` | **198** | ≥ `min_segments` (10) | ✅ |
| `segmentation_mode` | **sentence_info** | 含 `sentence_info` 或等价 | ✅ |
| `duration_sec` | 1249.78 | 有限正数 | ✅ |
| `wall_sec` | 168.18 | — | ✅ |
| `rtfx` | **7.43** | 有限正数 | ✅ |
| `warnings` | `[]` | 无 whole-track fallback | ✅ |
| `term_hit_rate` | **1.0** | 可观测（ACC-EVAL-1 兼容） | ✅ |
| `engine` | `funasr+iic/speech_paraformer-large-vad-punc_…` | Paraformer | ✅ |

**与 2026-06-03 spike baseline 对照**（同制控 ~21min）：语段 **197 → 198**（±1）；wall **155.5s → 168.2s**；RTFx **~8.0 → 7.43** — 同机/SKU 合理波动。

## 契约回归

```bash
npm run asr:test -- -q tests/test_eval_metrics.py tests/test_eval_run_csv.py tests/test_eval_manifest.py
```

- [x] **20 passed**（2026-06-11）

## 备注

- `low_confidence_ratio: 1.0`：Paraformer Profile 侧标记行为，非 ACC-EVAL-2 阻塞项。
- `cer_chars: null`：manifest 无 `reference_transcript`，符合设计。
- `term_hit_rate: 1.0` 表示「制控」在拼接假设中子串命中；不表示专名 ASR 已完美（正文仍有「质控」等同音变体）。

## 签收

- [x] E1–E5（intent §5）自动化 ✅
- [x] 制控 long-form 手测 ✅
- [x] `--assert-min-segments` 通过 ✅
