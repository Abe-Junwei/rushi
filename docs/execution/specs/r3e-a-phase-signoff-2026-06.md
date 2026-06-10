# R3e-A 阶段签收（2026-06）

**状态** ✅ **长音频动态超时 + 失败可诊断 — 2026-06 复验签收**

> **Acceptance**：[`r3e-long-audio-transcribe-acceptance.md`](./r3e-long-audio-transcribe-acceptance.md)  
> **手测清单**：[`r3e-a-hand-test-checklist.md`](./r3e-a-hand-test-checklist.md)  
> **50min 主路径日志（2026-05-30）**：[`r3e-b-hand-test-checklist.md`](./r3e-b-hand-test-checklist.md) §2（同会话 `timeout_s=7200`）

## 交付摘要

| 项 | 落位 |
|----|------|
| 动态 HTTP 超时 | `transcribe_timeout.rs` · `run_transcribe_cmd.rs` |
| 失败分类文案 | `transcribe_errors.rs` · `transcribe.rs` |
| 长音频 UI 提示 | `long_audio_transcribe_hint` · `asrTranscribeHints.ts` |
| 自动化门禁 | `scripts/r3e-a-hand-test.sh` |

## 机器闸门（2026-06-07）

```bash
bash scripts/r3e-a-hand-test.sh
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

| 层 | 结果 |
|----|------|
| `cargo test transcribe_*` | ✅ 20 passed |
| `asrTranscribeHints.test.ts` | ✅ 16 passed |
| L0 闸门 | ✅ typecheck · 1142 tests · arch-guard 0 errors |
| 制控.mp3 ffprobe | ✅ ~1249s（>10min 回归素材可用） |

## 手测范围

| 项 | 结果 | 说明 |
|----|------|------|
| §A ~50min `timeout_s=7200` | ✅ | 2026-05-30 log：`audio_duration_sec=Some(2918.24325)` · 本轮 log 已轮转，以历史证据 + 单测 `timeout_scales_and_caps` 复验 |
| §B 短音频 ≤10min | ✅ | 2026-05-27 手测 + 单测下限 600s |
| §C 停侧车失败可诊断 | ✅ | 2026-05-27 手测（中文文案，非裸 `error sending request`） |
| §D 多段质量 | ➖ 不在 R3e-A 范围 | Q-R3e-1 → **R3t-A + R3e-B**（已 ✅） |

## 签收决策（2026-06-07）

| 决策 | 说明 |
|------|------|
| **签收范围** | R3e-A 快修：按音频时长推导超时（600–7200s）、失败分类、>30min 提示、desktop 阶段日志 |
| **与 R3e-B 关系** | 50min 完成路径依赖 R3e-B 分窗；R3e-A 只保证不再 600s 静默超时 + 失败可诊断 |
| **本轮代码** | 无业务改动；补 `r3e-a-hand-test.sh` + 本 signoff，闭合路线图「待签收」 |

## 闭合条件

```text
bash scripts/r3e-a-hand-test.sh → PASS
+ acceptance §R3e-A 四项均已勾选（含 2026-05 手测证据）
```

## 下一刀（路线图）

**TRN-DIAG**（转写阶段时间线）· 并行 **ASR-WARM** — 见 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10

**3 行日志**

```text
改动：R3e-A 复验闸门（r3e-a-hand-test.sh + signoff）；无 Rust/UI 行为变更
验证：transcribe_* 20/20 · L0 1142 tests · 50min timeout 证据 2026-05-30 + 单测 7200 cap
下一轮：TRN-DIAG / ASR-WARM（并行）
```
