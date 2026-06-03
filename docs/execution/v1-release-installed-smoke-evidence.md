# v1 安装包冒烟证据

- **时间（UTC）**：2026-06-03T14:54:34Z
- **包**：`/Users/junwei/开发/Rushi/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`
- **机器结论**：进程启动 ✅ · 复用既有 App Data（若存在）✅

## 仍需 UI 手测（5 步）

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测。

## 本次自动检查

- `open -n` 启动后 `pgrep rushi-desktop` 通过
- `desktop.log` / `rushi.sqlite3` / `quality/last_eval_report.json` 状态见构建日志
