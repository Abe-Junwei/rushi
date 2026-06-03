# R4 + R4-GATE 签收（2026-06-03）

> **真源**：路线图 §732 · [personal-solo-v1-backlog.md](./personal-solo-v1-backlog.md) §3.4

## 机器门禁

| 项 | 结果 |
|----|------|
| `bash scripts/r4-gate-hand-test.sh` | ✅ 2026-06-03 |
| `npm run typecheck` | ✅ |
| ASR `/health`（8741） | ✅ `funasr_required_models_cached: true` |

## R4-GATE（制控专名）

| 项 | 结果 |
|----|------|
| 命令 | `eval-run.py --filter-id proper-noun-zhikong --hotwords-mode manifest --output …/quality/last_eval_report.json` |
| 耗时 | ~5m51s（2026-06-03 21:59–22:05） |
| `exit_code` | 0 |
| `term_hit_rate` | **1.0**（`expected_terms: 制控`，hypothesis 含「制控」子串） |
| `error` | 无 |
| 引擎 | `funasr+iic/SenseVoiceSmall` |
| 报告路径 | `~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/quality/last_eval_report.json` |

**说明**：长音频 warnings（`funasr_long_audio_no_segments` 等）与 SenseVoice 路径一致；门禁以 **term_hit** 为准，本次通过。

## 桌面 UI（2026-06-03 手测）

- [x] 欢迎页 → **质量概览** 自动显示摘要（`评测完成，全部条目成功`）
- [x] 门禁 `proper-noun-zhikong` **term_hit 100.0%**，失败条目 **0**，完成时间与批跑一致
- [x] 报告路径与 `last_eval_report.json` 一致；明细表状态 **ok**

## 签收

| 日期 | 范围 | 结论 |
|------|------|------|
| 2026-06-03 | R4 + R4-GATE（机器 + 批跑 + UI） | ✅ 已签收 |
