# R3f 首装空 App Data — 手测证据

- **时间（UTC）**：2026-06-20T05:08:13Z
- **macOS**：26.5.1
- **隔离 HOME**：`/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//rushi-fresh-home.cvqkQF`（测试结束已删除）
- **包**：`/Applications/如是我闻.app`
- **命令**：`bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --with-ui --skip-download`

## 结论

| 项 | 结果 |
|----|------|
| release `.app` + 空 App Data 启动 | ✅ |
| bundled 侧车 `/health` `funasr_import_ok` | ✅ |
| 首装模型未缓存（预期 `funasr_default_model_cached=false`） | ✅ 见 `health-after-sidecar.json` |
| 一键准备（ui-interactive）→ `ready_for_transcribe` | ⏸ skip-download0 |
| UI osascript | interactive |
| log 无 `desktop:dev` 文案 | ✅ |

## 产物

- Artifacts: `/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//r3f-fresh-20260620-130217`（临时目录，可手动清理）

## 说明

- 隔离 `HOME` 等价于干净用户首装 App Data，**不修改**主 `~/Library/Application Support/...`。
- release bundled 侧车须 UI「一键准备」（Tauri loopback）；请用 `--interactive`，勿用裸 `curl`。
