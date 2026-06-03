# R9 — REL-1 个人单机 v1 代跑签收（2026-06-03）

> **命令**：`bash scripts/r9-rel-1-hand-test.sh`（首轮 ~7min）· `bash scripts/r9-rel-1-machine-gate.sh`  
> **产物目录**：`/var/folders/.../T/r9-rel-1-20260603-221343`（切片 proxy）· `...-222206`（H6/A/B 续跑）

## 硬门禁

| # | 项 | 结果 | 证据 |
|---|-----|------|------|
| H1 | 机器守卫 | ✅ | `r9-rel-1-machine-gate.sh` · typecheck + 749 tests + guard 0 错误 |
| H2 | R4-GATE | ✅ | [r4-quality-gate-signoff](./r4-quality-gate-signoff-2026-06.md) · `term_hit_rate=1.0` |
| H3 | R3t-B | ✅ | `scripts/r3t-b-hand-test.sh` · 侧车 gate + 短转写 smoke |
| H4 | R3t-C | ✅ | `scripts/r3t-c-hand-test.sh` · TS+Rust 标点回归 |
| H5 | R3e-B | ✅ | `scripts/r3e-b-hand-test.sh` · [2026-05-30 长音频签收](./r3e-long-audio-transcribe-acceptance.md) |
| H6 | EXP-WORD | ✅ | Rust `export_docx::` 10 + `export_track` 4 + TS 22；[exp-word acceptance](./exp-word-formatted-export-acceptance.md) 已签收 |
| H7 | REV-LOC | ✅ | `rev-loc-slice-{a,b}-hand-test.sh` · [acceptance](./rev-loc-undo-edit-history-acceptance.md) |

## 主路径（机器 + 环境代理）

| 项 | 结果 | 说明 |
|----|------|------|
| A2/A3 | ✅ | `/health` ready · catalog 2 项 · `local_runtime`+`models` 目录存在 |
| A1 | 🟡 代理 | 模型已缓存、无 corrupt 阻塞；**未**在本轮重做「清空后零终端向导」UI |
| B3 | ✅ | `制控.mp3` + `hotwords=制控` → 262 segments · 输出含制控/质控 |
| B1 | ✅ 代理 | 工程内 3 路 10–30min 音频；语段 176 行；⑤c 13min 历史签收 |
| B2 | ✅ 代理 | 最长 1350s（~22.5min）+ R3e-B 50min 手测签收；未重跑整段 50min |
| C1/C2 | ✅ 代理 | REV-LOC 机器回归 + 2026-06 切片签收；未重开桌面 ⌘Z/恢复 UI |
| D1 | ✅ 代理 | EXP-WORD 单元/结构测试 + 2026-06-03 手测签收；未重开 Word 目视 |
| D2 | ✅ | `rushi.sqlite3` · projects=1 · segments=176 |
| E1 | ✅ | `quality/last_eval_report.json` · exit_code=0 · term_hit OK |
| F5 E2E | ✅ | `npm run desktop:test:e2e` · 2/2 passed |

## 未跑（不挡 v1 代理签收）

- F1–F4：R3t-D/E、TRN-DIAG、ASR-WARM、弱网续传  
- P0：`fixtures/p0-samples` 不足 10 条（仓库未备齐）

## 结论

**R9 机器与历史签收代理：通过**，可标路线图 **R9 ✅（代理签收）**。  
若发版硬要求 **A1 零终端 UI 重走一遍** 或 **B2 当场 50min Paraformer**，补一轮桌面手测后把 acceptance 中 A1/B2 从「代理」改为「手测」。
