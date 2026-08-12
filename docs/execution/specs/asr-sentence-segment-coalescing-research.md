# 调研：ASR 短语段保守合并

> **状态**：已采纳（2026-08-11）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 `R3h-ASR-VER`
> **关联 spec**：[`asr-sentence-segment-coalescing-intent.md`](./asr-sentence-segment-coalescing-intent.md) · [`asr-sentence-segment-coalescing-plan.md`](./asr-sentence-segment-coalescing-plan.md) · [`asr-sentence-segment-coalescing-acceptance.md`](./asr-sentence-segment-coalescing-acceptance.md)

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 长音频转写后出现大量 1–2 秒、数个字的语段，浏览和编辑过于零碎。 |
| 本仓现状 | `segmentation.py` 直接把 FunASR `sentence_info` 每行映射为产品语段，无粒度整形。D3 基线 186 段，中位 1.897s / 8 个内容字，95 段短于 2s。 |
| 成功标准 | 不改全文内容和时间顺序；D3 语段数下降约 20%–35%；不跨越 >0.8s 明显停顿；合并段不超过 15s / 40 内容字。 |

## 2. 成熟路线

| 路线 | 核心机制 | 取舍 |
|------|----------|------|
| VAD 段直出 | 以声学静音作硬边界 | 时间稳定，但容易把一句话切成多个短段。 |
| PUNC 句级边界 | 用标点模型产生 `sentence_info` | 当前主路；语义更好，但短停顿和短句仍过细。 |
| 受约束后合并 | 在句级边界上按 gap、时长和字数贪心合并 | 保留声学时间真源，可测、可回滚，最符合 Rushi。 |
| LLM 语义合并 | 转写后输出 merge/split ops | 已属 R3t-D；需用户预览/确认，不适合替代本机默认分段。 |

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 冲突/成本 |
|------|--------|------------------|-----------|
| FunASR `1.3.30` `_join_vad_texts()` | 低 | 无；它只改 PUNC 输入 | D3 语段数和 186 个时间边界完全不变，且文字与时间段错位。 |
| `segmentation.py` 句级解析 | 高 | 时间单位归一、`TranscriptionSegment` 契约 | 只需在返回前加一个纯函数，不建第二套分段栈。 |
| R3t-D LLM 段界校准 | 中 | 后续可对合并结果再精修 | 不引入侧车、网络或 UI 新依赖。 |

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 保持 FunASR `1.3.16`；在 `segments_from_sentence_info()` 后做受约束贪心合并。 |
| 默认阈值 | 当前累积段 <3s 或 <12 内容字，且下一段 gap <=0.8s，合并后 <=15s / <=40 字时合并。 |
| 不做什么 | 不用 `_join_vad_texts()` 代替粒度整形；不改 VAD 权重/参数；不引入 SenseVoice、LLM 或 UI 设置。 |
| 架构关系 | 继续由 `segmentation.py` 作 L2 唯一分段真源；契约和 `segmentation_mode=sentence_info` 不变。 |

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Python ASR | `services/asr/rushi_asr/segmentation.py` | 新增短语段合并纯函数 |
| 测试 | `services/asr/tests/test_funasr_engine.py` | gap / 时长 / 字数 / 全文不变 |
| 评测 | `scripts/eval-run.py` | 复用 segment count / CER，不另造 runner |
| UI / Rust | 无 | 契约不变 |

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接
- [x] 用户已确认需要改善过细分段

