# ASR-VOC-3 签收（2026-06-02）

> **验收真源**：[r3-asr-voc-landing-acceptance.md](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-3  
> **手测清单**：[asr-voc-3-hand-test-checklist.md](./asr-voc-3-hand-test-checklist.md)

## 编码交付

| ID | 交付 |
|----|------|
| V3-1 | `glossary_hotwords` `ORDER BY COALESCE(updated_at_ms, created_at_ms) DESC`；`openai_prompt` 用有序 `terms` join + 224 截断 |
| V3-2 | `assemblyai_keyterms` ≤100 + warning 单测 |
| V3-3 | `append_deepgram_keywords` ≤50 + warning 单测；**boost / Nova-3 keyterm Defer**（Plan §4.2） |
| V3-4 | `sttVocabularyBias` FIELD_HINT / `glossaryBiasSummaryForProviderId` 含上限与 keyterms 说明 |
| V3-5 | `asrTranscribeHints` 三家 `online_vocabulary_truncated_*` 分型文案 |

## 机器验证

```bash
bash scripts/asr-voc-3-hand-test.sh
```

| 项 | 结果 |
|----|------|
| `npm run typecheck && npm run test` | ✅ |
| `check-architecture-guard.mjs` | ✅ |
| `cargo test stt_vocabulary` | ✅ |
| `cargo test glossary_hotwords` | ✅ |
| `sttVocabularyBias.test.ts` / `asrTranscribeHints.test.ts` | ✅ |

## 在线 E2E 闸门

> Holistic D8：**VOC-3 签收前** ACC 在线手测 ≥1 家（OpenAI / AssemblyAI / Deepgram）。  
> 无 API Key 时：机器契约已绿；**§3 手测待有 Key 后勾选**（不挡本机 FunASR / 其它 VOC 包）。

- [ ] [asr-voc-3-hand-test-checklist.md](./asr-voc-3-hand-test-checklist.md) §1–§3

## 签收

| 日期 | 范围 | 结论 |
|------|------|------|
| 2026-06-02 | 编码 + 机器回归 | ✅ |
| | 在线 E2E §1–§3 | 待 Key / 手测 |
