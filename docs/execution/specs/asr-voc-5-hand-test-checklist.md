# ASR-VOC-5 手测清单 — 热词 on/off eval baseline

> **状态**：✅ 手测签收（2026-06-03）  
> **验收真源**：[`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-5  
> **脚本**：`npm run eval:run:hotwords-ab` · [`docs/execution/fixtures/asr-hotword-eval/README.md`](../fixtures/asr-hotword-eval/README.md)

## 环境

- [x] `curl -sf http://127.0.0.1:8741/health` → `ready_for_transcribe: true`
- [x] 本机活跃 SKU：**Paraformer 长音频**（`paraformer-long-vad-punc`）
- [x] 样例：`fixtures/eval/samples/制控.mp3` 存在

## 执行

```bash
npm run eval:run:hotwords-ab
```

## 结果（2026-06-03）

| `hotwords_ab_variant` | `hotwords_enabled` | `hotwords_sent` | `term_hit_rate` | `engine` | `warnings` |
|----------------------|-------------------|---------------|-----------------|----------|------------|
| on | true | 制控 | 0.0 | `funasr+iic/speech_paraformer-large-vad-punc_…` | （空） |
| off | false | — | 0.0 | 同上 | （空） |

- [x] on/off **各跑通一条**，无 `error`；CSV 两行可对比存档  
- [x] `hotwords_enabled` / `hotwords_ab_variant` 与模式一致  
- [x] `term_hit_rate` **有数值**（本次均为 0.0；验收不要求 off 更高，仅要求可观测）

**备注**：制控样例本次假设文本未子串命中「制控」，baseline 已记录；后续可换参考稿或 SKU 对比时再跑同一命令。

## 契约回归

```bash
npm run asr:test -- -q tests/test_eval_manifest.py
```
