# R3f 首装空 App Data — 手测证据

- **时间（UTC）**：2026-06-20T16:29:15Z
- **macOS**：26.5.1
- **隔离 HOME**：`/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//rushi-fresh-home.XBiH03`（应用仍运行，关闭后可手动删除）
- **包**：`/Users/junwei/开发/Rushi/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`
- **命令**：`bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs`

## 结论

| 项 | 结果 |
|----|------|
| release `.app` + 空 App Data 启动 | ✅ |
| bundled 侧车 `/health` `funasr_import_ok` | ✅ |
| 首装模型未缓存（预期 `funasr_default_model_cached=false`） | ✅ 见 `health-after-sidecar.json` |
| 一键准备（ui-interactive）→ `ready_for_transcribe` | ✅ |
| UI osascript | interactive |
| log 无 `desktop:dev` 文案 | ✅ |

## 产物

- Artifacts: `/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//r3f-fresh-20260621-002304`（临时目录，可手动清理）

## 说明

- 隔离 `HOME` 等价于干净用户首装 App Data，**不修改**主 `~/Library/Application Support/...`。
- release bundled 侧车须 UI「一键准备」（Tauri loopback）；手测请用 `--interactive`（无需辅助功能，通过后应用保持打开）。`--with-ui` 仅 CI/已授权辅助功能时使用；需通过后自动关应用时加 `--exit-after-pass`。
