# R3f 首装空 App Data — 手测证据

- **时间（UTC）**：2026-06-09T02:55:29Z
- **macOS**：26.5.1
- **包**：`apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`
- **命令**：`bash scripts/r3f-fresh-appdata-hand-test.sh --interactive`
- **操作者**：junwei（UI 一键准备 + 脚本轮询）

## 结论

| 项 | 结果 |
|----|------|
| release `.app` + 隔离空 App Data 启动 | ✅ |
| bundled 侧车 `/health` `funasr_import_ok` | ✅ |
| 首装 `funasr_default_model_cached=false`（启动后、准备前） | ✅ |
| UI「设置 → 本机 ASR → 一键准备」→ `ready_for_transcribe` | ✅（~12min，脚本轮询确认） |
| log 无 `desktop:dev` / npm 教程文案 | ✅ |

## 运行摘要

```text
funasr_default_model_cached=False ready_for_transcribe=False   # 首装侧车就绪、模型未缓存
>>> UI 一键准备（人工）
OK: ready_for_transcribe after interactive one-click
```

## 说明

- 隔离 `HOME`（`mktemp`）等价于干净用户首装，**未修改**主 `~/Library/Application Support/...`。
- bundled 侧车 `local_token_required`：模型下载须应用内 loopback，脚本用 `--interactive` 轮询 `/health`，不裸 `curl`。
- AppleScript 无法点击 WebView 内按钮；`--with-ui` 不适用 release 包。

## 关联

- [r3f-phase-signoff-2026-06.md](./r3f-phase-signoff-2026-06.md)
- [release-zero-terminal-hand-test.md](../release-zero-terminal-hand-test.md) §1
