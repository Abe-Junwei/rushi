# R3h-0 阶段签收（2026-06）

**状态** 🟡 **部分签收** — macOS 机器闸门 ✅；Windows 手测 ⏳

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

单独复验 smoke：

```bash
bash scripts/smoke-asr-sidecar-health.sh
# smoke OK: stub ffmpeg_ok= True
# smoke root OK: catalog endpoints present
```

## 手测

| 项 | 结果 | 日期 |
|----|------|------|
| §1 mac smoke | ✅ | 2026-06-06 |
| §2 corrupt 诊断 | ⏸ 可选 | — |
| §3 pip 降级 | ✅ 自动化 | — |
| §4 Windows | ⏳ | — |

## 闭合条件

```text
mac 机器闸门 ✅ + Win §4 手测 ✅
→ R3h-0 全绿 → R3f 安装包手测可启动（仍建议 R3h-1 发行门禁对齐）
```

## 下一轮

→ **Win 机补 §4**（或登记「无 Win 机，mac-only 签收」决策）  
→ **R3f 安装包手测**（mac 零终端）  
→ **R3h-1** 发行门禁剩余项（§11 remediation）

## 日志

```text
改动：R3h-0 验收三件套 + machine gate（编码已在 main）
验证：smoke-asr-sidecar-health.sh ✅ · cargo test asr_setup 11/11 ✅
阻塞：Windows 构建 smoke + 磁盘手测未跑
```
