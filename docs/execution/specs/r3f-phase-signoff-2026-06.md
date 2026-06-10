# R3f 阶段签收（2026-06）

**状态** ✅ **macOS 安装包机器 + ASR 就绪签收** — Windows 安装包 ⏳ 待 Win 机

> **Acceptance**：[`r3f-asr-setup-wizard-acceptance.md`](./r3f-asr-setup-wizard-acceptance.md)  
> **零终端清单**：[`release-zero-terminal-hand-test.md`](../release-zero-terminal-hand-test.md)  
> **机器证据**：[`r3f-installed-hand-test-evidence.md`](./r3f-installed-hand-test-evidence.md)

## 交付摘要

| 项 | 落位 |
|----|------|
| 一键准备编排 | `useAsrSetupController.ts` + `asr_setup/` |
| 8741 冲突 | `useAsrSetupController.oneClick.test.ts` |
| pip 降级 | `LocalAsrAdvancedSection.tsx` |
| 安装包 smoke | `scripts/v1-release-installed-smoke.sh` |
| R3f 机器门禁 | `scripts/r3f-installed-hand-test.sh` |

## 机器闸门

```bash
npm run desktop:build-app
bash scripts/r3f-installed-hand-test.sh
bash scripts/r3f-fresh-appdata-hand-test.sh --interactive   # 首装空 App Data + UI 一键准备
```

| 日期 | 平台 | 结果 |
|------|------|------|
| 2026-06-09 | macOS arm64（release `.app` + `/health` + 回归） | ✅ |
| 2026-06-09 | macOS 首装空 App Data + UI 一键准备 | ✅ |

复验摘要：`v1-release-installed-smoke` ✅ · R3f TS 12/12 · `asr_setup` 11/11 · `/health` `funasr_ready` + `funasr_default_model_cached` ✅ · 近期 log 无 `desktop:dev` 文案

## 手测范围

| 项 | 结果 | 说明 |
|----|------|------|
| §1 安装包启动 + ASR 就绪 | ✅ 机器 | 日志 `bundled_sidecar_already_healthy`；本机 **非首装**（复用 App Data） |
| §1 首装空 App Data「一键准备」 | ✅ UI | 2026-06-09 · `--interactive` · [evidence](./r3f-fresh-appdata-hand-test-evidence.md) |
| §2–§4 导入/波形/转写/导出 | ✅ 代理 | 同机 [R9 strict](./r9-rel-1-strict-signoff-2026-06.md) · [v1 installed](../v1-release-installed-signoff-2026-06.md) |
| §5–§6 Stage B / 重启 | ⏸ 可选 | 非 R3f 阻塞 |
| Windows 安装包 | ⏳ | 待 Win 开发机 |

## mac-only 签收决策（2026-06-09）

| 决策 | 说明 |
|------|------|
| **签收范围** | macOS release `.app` 零终端 ASR 就绪路径（bundled 侧车 + 模型缓存 + 无 dev 文案） |
| **与 desktop:dev 关系** | `desktop:dev` 手测已于 2026-05-27 签收；本轮补 **安装包** 机器闭环 |
| **Win** | 不阻塞 mac 签收；有 Win 机时补 R3f-E |

## 闭合条件

```text
mac: bash scripts/r3f-installed-hand-test.sh → PASS
     + bash scripts/r3f-fresh-appdata-hand-test.sh --interactive → PASS（2026-06-09）
Windows: 待补
```

## 下一刀（路线图）

**TRN-DIAG** 转写阶段时间线 · 并行 **ASR-WARM** — 见 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10
