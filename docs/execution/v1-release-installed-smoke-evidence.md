# v1 安装包冒烟证据

- **时间（UTC）**：2026-07-18T04:53:35Z
- **包**：`/Users/junwei/开发/Rushi/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`
- **App Data**：`/Users/junwei/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi`
- **机器结论**：进程启动 ✅ · App Data 可写 ✅ · bundled ffmpeg/ffprobe ✅ · sidecar stamp ✅ · diagnostic zip ✅
- **侧车构建**：`git_sha=739eb63 built_at=2026-07-18T04:50:22Z platform=Darwin-arm64`
- **备注**：smoke 前自动 deep adhoc `codesign`；CPU lock 已刷（pillow 12.3 / setuptools 83 / torch 2.13）

## 仍需 UI 手测

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测；全量审查见 [`specs/pre-release-full-audit-2026-07.md`](./specs/pre-release-full-audit-2026-07.md) mac L3/L4。

## 本次自动检查

- bundled `ffmpeg` 在 Resources
- bundled `ffprobe` 在 Resources
- bundled sidecar build stamp 在 Resources
- App Data 写入探针通过
- LaunchServices `open -n` 启动探针通过
- automation binary launch 后 `pgrep rushi-desktop` 通过
- 自动诊断包生成并包含 release parity 证据文件
- `/health` 与 peaks 计数见构建日志
- `desktop.log` parity 摘要见终端输出
