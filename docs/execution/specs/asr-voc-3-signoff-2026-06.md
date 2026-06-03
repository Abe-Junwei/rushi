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

## 手测（2026-06-02）

| 范围 | 结论 | 备注 |
|------|------|------|
| §1 环境页映射文案 | ✅ | 三家上限 / keyterms 说明已核对 |
| §2–§3 在线拉取 E2E | **豁免** | 团队无 OpenAI/AssemblyAI/Deepgram API Key；以机器单测 + hints 文案替代 |

> 与 [acc-stt-unify-hand-test-checklist.md](./acc-stt-unify-hand-test-checklist.md)「在线 ⏳」一致；有 Key 后可补跑 §2–§3 作回归，**不阻塞** ⑤″f-E / EXP-WORD。

- [x] [asr-voc-3-hand-test-checklist.md](./asr-voc-3-hand-test-checklist.md)

## 签收

| 日期 | 范围 | 结论 |
|------|------|------|
| 2026-06-02 | 编码 + 机器回归 | ✅ |
| 2026-06-02 | 文案手测 §1 | ✅ |
| 2026-06-02 | 在线 E2E §2–§3 | 豁免（无 Key）· **VOC-3 薄片闭环** |
