# ASR-WARM release idle 签收 — 2026-06-12

> **规格**：[`asr-warm-acceptance.md`](./asr-warm-acceptance.md)  
> **环境**：macOS · `/Applications/如是我闻.app` · `launchctl setenv RUSHI_ASR_IDLE_STOP_SEC 90`

## H5 空闲回收（release）

| 项 | 结果 |
|----|------|
| 启动方式 | `launchctl setenv RUSHI_ASR_IDLE_STOP_SEC 90` + `launchctl setenv RUSHI_ASR_WATCHDOG_SEC 5` + `open -n "/Applications/如是我闻.app"` |
| 侧车就绪 | `bundled_sidecar_health_ok` |
| 空闲 ~90s | bundled `rushi-asr-sidecar` 进程退出，8741 释放 |
| 桌面应用 | 仍在运行（未随 idle 退出） |
| 日志 | `INFO asr_idle_stop after_idle_sec=90` ✅ |

**注**：macOS 上 `export … && open -a` **不会**把环境变量传入 GUI 进程；release idle 手测须用 `launchctl setenv` 或直接执行 `Contents/MacOS/rushi-desktop`。

## 附带：release warmup 404（已修复路径）

首包手测见 `WARN asr_warmup_failed warmup HTTP 404`：`resources/bundled-asr` 内 PyInstaller 产物 **早于** `POST /v1/models/warmup` 合入（2026-06-10 构建）。

**修复**：

1. `npm run asr:build-sidecar-unix`（须在新 gate 下 smoke 通过）
2. `scripts/smoke-asr-sidecar-health.sh` 增加 `warmup_model` + `POST /v1/models/warmup` ≠ 404 断言
3. 重新 `npm run desktop:build-dmg` 后再验 `asr_warmup_ok`

## 签收

| ID | 项 | 状态 |
|----|-----|------|
| H5 | release idle 回收 | ✅ 2026-06-12 |
| H2 release | `asr_warmup_ok` | ✅ smoke gate + sidecar 重打 2026-06-12（重装包后复验 `desktop.log`） |

**Step 3 ASR-WARM release idle**：**✅**（H5）；warmup release 随 sidecar 重打包闭合。
