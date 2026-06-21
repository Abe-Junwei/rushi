# R3f 安装包手测 — 机器证据

- **时间（UTC）**：2026-06-21T11:29:06Z
- **macOS**：26.5.1
- **包**：`/Applications/如是我闻.app`
- **App Data**：`/Users/junwei/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi`
- **命令**：`bash scripts/r3f-installed-hand-test.sh`

## 机器结论

- release `.app` 启动 smoke ✅
- R3f TS 回归（one-click / install / diagnose / advanced UI）✅
- `asr_setup` Rust 11 tests ✅
- `/health`：`funasr_ready` + `funasr_default_model_cached` ✅
- 近期 `desktop.log` 无 `npm run desktop:dev` 文案 ✅

## 仍需 UI 手测（或 R9/v1 代理）

见 [release-zero-terminal-hand-test.md](../release-zero-terminal-hand-test.md) §1 一键准备（**首装空 App Data**）、§2–§6 导入/转写/导出/重启。

本机 **非首装**（复用既有 App Data + 模型缓存）；启动日志 `bundled_sidecar_already_healthy` 等价于零终端 ASR 就绪。
