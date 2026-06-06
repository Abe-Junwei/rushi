# v1 安装包冒烟证据

- **时间（UTC）**：2026-06-06T09:29:10Z
- **包**：`/Users/junwei/开发/Rushi/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`
- **App Data**：`/Users/junwei/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi`
- **机器结论**：进程启动 ✅ · bundled ffmpeg ✅

## 仍需 UI 手测

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测。

## 本次自动检查

- bundled `ffmpeg` 在 Resources
- `open -n` 后 `pgrep rushi-desktop` 通过
- `/health` 与 peaks 计数见构建日志
