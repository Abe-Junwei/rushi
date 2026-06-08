# R3h-0 阶段签收（2026-06）

**状态** ✅ **macOS 范围签收** — 机器闸门 ✅（2026-06-08 复验）；**Windows §4** ⏳ 登记豁免（无 Win 开发机）

> **Acceptance**：[`r3h-0-asr-sidecar-build-smoke-acceptance.md`](./r3h-0-asr-sidecar-build-smoke-acceptance.md)  
> **手测**：[`r3h-0-hand-test-checklist.md`](./r3h-0-hand-test-checklist.md)

## 交付摘要

| 项 | 落位 |
|----|------|
| Post-build smoke | `scripts/smoke-asr-sidecar-health.sh` |
| Unix / Win 构建挂钩 | `build-asr-sidecar-unix.sh`、`build-asr-sidecar-windows.ps1` |
| `sidecarIntegrity` | `asr_setup/diagnose.rs` + 11 tests |
| Win 磁盘 | `local_runtime/install_support/mod.rs` |
| pip UI 降级 | `LocalAsrAdvancedSection.tsx` |

## 机器闸门

```bash
bash scripts/r3h-0-machine-gate.sh
```

| 日期 | 平台 | 结果 |
|------|------|------|
| 2026-06-06 | macOS（bundled smoke + cargo + UI test） | ✅ |
| 2026-06-08 | macOS 复验（发版修复后） | ✅ |

复验摘要：`smoke OK` · `asr_setup` 11/11 · `LocalAsrAdvancedSection` 1/1 · architecture guard 0 errors

## 手测

| 项 | 结果 | 日期 |
|----|------|------|
| §1 mac smoke | ✅ | 2026-06-06 |
| §2 corrupt 诊断 | ⏸ 可选 | — |
| §3 pip 降级 | ✅ 自动化 | — |
| §4 Windows | ⏳ 豁免 | — |

## mac-only 签收决策（2026-06-08）

| 决策 | 说明 |
|------|------|
| **签收范围** | macOS arm64  bundled 侧车 smoke + 诊断编码 + pip UI 降级 |
| **Win §4** | 无 Windows 开发机；**不阻塞** mac 签收（acceptance 已声明） |
| **后续** | 有 Win 机时补 §4；CI `release.yml` Windows 构建仍覆盖构建 smoke |

## 闭合条件

```text
mac 机器闸门 ✅ + mac 安装包手测（波形/CSP 等）✅
→ R3h-0 mac 范围闭合
→ R3f 安装包零终端手测可继续（仍受 R3h-1 发行门禁约束）
Win §4 →  backlog，有 Win 机时补测
```

## 下一轮

→ **R3f 安装包手测**（mac 零终端；[`release-zero-terminal-hand-test.md`](../release-zero-terminal-hand-test.md)）  
→ **Project Hub 元信息** 或 **TRN-DIAG / ASR-WARM**（并行，不挡主序）  
→ **Win 机补 §4**（可选）  
→ **R3h-1** 发行门禁剩余项（§11 remediation）

## 日志

```text
改动：R3h-0 mac 范围签收；Win §4 登记豁免
验证：bash scripts/r3h-0-machine-gate.sh ✅（2026-06-08）
      安装包手测：波形 CSP + seek + 根目录 DMG ✅（430deb7）
阻塞：无（mac）；Win §4 待有 Win 机
```
