# 转写准确度程序（ACC · 索引）

> **状态**：L2/L6 已部分落地；**⑤″f 整体性评估**（2026-05-31）：[`r3-asr-voc-holistic-review-2026-05.md`](../execution/specs/r3-asr-voc-holistic-review-2026-05.md)

## L0–L7 真源（勿在本文件重复展开）

| 层 | 文档 / 路线图 |
|----|----------------|
| L2 听写（热词、SKU、在线 adapter） | [`asr-vocabulary-bias-practices.md`](./asr-vocabulary-bias-practices.md)、[`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md)；R3g-C ✅、ACC-STT-UNIFY ✅ |
| L4 改稿（memory、LexiconPack） | [`lexicon-guided-llm-refine.md`](./lexicon-guided-llm-refine.md)；R3t-E；**⑤″f** R3t-F |
| L6 eval | **⑤″f-5** = ACC-EVAL-1 = ASR-VOC-5；`fixtures/eval`、`npm run eval:run` |
| 排期 | [`rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) §4.1.6 ACC、§4.1.1 **⑤″f** |

立项后若需独立 ACC Epic 验收，从 holistic review §6 包级表派生，**禁止**第二套 glossary 真源。
