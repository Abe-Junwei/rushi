# Acceptance: R3h-0 — 侧车构建 smoke + 发行止血门禁

> **状态**：🟡 **macOS 机器闸门 ✅**（2026-06-06）；**Windows 手测 ⏳**（无 Win 机时登记豁免，不挡 mac 签收）  
> **Research / 整改真源**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) **§5 Phase 0**  
> **排期**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) **§4.1.1 ①**  
> **手测**：[`r3h-0-hand-test-checklist.md`](./r3h-0-hand-test-checklist.md)  
> **签收追踪**：[`r3h-0-phase-signoff-2026-06.md`](./r3h-0-phase-signoff-2026-06.md)

## 目标

任何 CI / 本地打出的 FunASR 侧车 onedir **必定**通过 post-build smoke；损坏包在应用内可被 `sidecarIntegrity: corrupt` 识别；主 UI 不暴露 pip 主路径；Windows 磁盘诊断与 Unix 对齐。

## 能力—UI 状态矩阵（Phase 0）

| 能力 | UI / 诊断字段 | 通过条件 |
|------|---------------|----------|
| bundled exe 存在 | `bundledAvailable` | 找到有效侧车 exe |
| 包体完整（funasr 数据等） | `sidecarIntegrity` | smoke 绿 → `ok`；health 500 + exe 在 → `corrupt` |
| 运行时 import | `/health` → `funasr_import_ok` | post-build smoke 断言 |
| 模型就绪 | `readyForTranscribe` | **不在 R3h-0**；R3f / R3h-1 范围 |
| 主路径零终端 | 本机 ASR 主区 | 无 pip 按钮；pip 仅在「高级诊断」折叠 |
| Windows 磁盘 | 准备/下载前诊断 | `disk_free_bytes` 有值；不足时有中文预警 |

## 交付对照（Phase 0 清单）

| 项 | 落位 | 状态 |
|----|------|------|
| PyInstaller `--collect-all funasr` + 兜底拷贝 | `scripts/build-asr-sidecar-unix.sh`、`build-asr-sidecar-windows.ps1` | ✅ |
| Post-build smoke | `scripts/smoke-asr-sidecar-health.sh`；构建脚本末尾调用 | ✅ |
| CI 可选重构建 | `.github/workflows/asr-sidecar-build-nightly.yml` | ✅ |
| `sidecarIntegrity: corrupt` | `apps/desktop/src-tauri/src/asr_setup/diagnose.rs` + tests | ✅ |
| Windows `disk_free_bytes` | `local_runtime/install_support/mod.rs` | ✅ 编码 |
| pip 主 UI 降级 | `LocalAsrAdvancedSection.tsx` + test | ✅ |
| 架构说明 | `docs/architecture/asr-pyinstaller-collect-notes.md` | ✅ |

## 机器闸门

```bash
bash scripts/r3h-0-machine-gate.sh
```

| 步骤 | 说明 |
|------|------|
| bundled smoke | 对 `resources/bundled-asr/` 产物跑 `/health` smoke（**gitignore，构建机须先** `npm run asr:build-sidecar-unix`） |
| `asr_setup` tests | `sidecarIntegrity` / corrupt 摘要等 11 项 |
| pip UI 回归 | `LocalAsrAdvancedSection.test.tsx` |
| 架构守卫 | `check-architecture-guard.mjs` |

完整重构建（可选，耗时长）：

```bash
npm run asr:build-sidecar-unix   # 内含 post-build smoke
# Windows（需 Win + Python 3.12）：
npm run asr:build-sidecar-windows-cpu
```

## 手测（§ [`r3h-0-hand-test-checklist.md`](./r3h-0-hand-test-checklist.md)）

1. **macOS**：bundled 侧车 smoke 绿（机器闸门覆盖）；可选 `desktop:dev` 验证 corrupt 诊断文案。  
2. **Windows**：构建脚本 smoke + 磁盘不足预警（**待 Win 机**）。  
3. **主 UI**：展开「环境与能力 → 本机 ASR」，确认主区无 pip；高级折叠内才有开发者说明。

## 与 R3f 关系

- **R3f 编码 ✅**；**安装包零终端手测**建议在 R3h-0 mac ✅ + R3h-1 发行门禁全绿后签收（见 [`r3f-asr-setup-wizard-acceptance.md`](./r3f-asr-setup-wizard-acceptance.md)）。  
- R3h-0 **不替代** R3h-1 的 LRC 下载 / manifest 手测。

## 不做什么

- 不新增第二套 sidecar 构建管线。  
- 不在 Phase 0 做 Sherpa 迁移或侧车体积优化（→ R3h-3.5）。  
- 不把 `readyForTranscribe` 与 `funasr_ready` 混为一个布尔。
