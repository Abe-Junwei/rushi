# R3f 首装空 App Data — 手测证据

- **时间（UTC）**：2026-06-21T12:54:32Z
- **macOS**：26.5.1
- **隔离 HOME**：`/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//rushi-fresh-home.Yx4HNY`（应用仍运行，关闭后可手动删除）
- **包**：`/Applications/如是我闻.app`
- **命令**：`bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs`

## 结论

| 项 | 结果 |
|----|------|
| release `.app` + 空 App Data 启动 | ✅ |
| bundled 侧车 `/health` `funasr_import_ok` | ✅ |
| 首装模型未缓存（预期 `funasr_default_model_cached=false`） | ✅ 见 `health-after-sidecar.json` |
| 一键准备 / bundled seed（bundled-seed-auto）→ `ready_for_transcribe` | ✅ |
| UI osascript | n/a |
| log 无 `desktop:dev` 文案 | ✅ |

## 产物

- Artifacts: `/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T//r3f-fresh-20260621-205420`（临时目录，可手动清理）

## 说明

- 隔离 `HOME` 等价于干净用户首装 App Data，**不修改**主 `~/Library/Application Support/...`。
- Plan B release 包首启自动 bundled seed（全屏遮罩）；脚本轮询 marker + `/health`，无需 UI 一键准备。Legacy 无随包模型时仍用 `--interactive` 或 `--with-ui`。
