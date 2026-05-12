# Bundled FFmpeg（侧车 PyInstaller）

侧车构建脚本会从 **eugeneware/ffmpeg-static** 发行版下载与平台匹配的 **ffmpeg / ffprobe** 单文件二进制（**darwin-arm64** / **darwin-x64** / **win32-x64** / **linux-x64**），经 PyInstaller `--add-binary` 打进 onedir，与可执行文件同目录；运行时 `rushi_asr.ffmpeg_audio` 优先使用该目录（见 `ffmpeg_audio.py`）。

- **来源**：<https://github.com/eugeneware/ffmpeg-static/releases>（当前脚本使用 tag **`b6.1.1`**；升级时同步改 `scripts/fetch-ffmpeg-sidecar.sh`）。  
- **许可**：以仓库随二进制提供的 `LICENSE` / `README` 为准（FFmpeg 多为 **GPL**；发布说明与安装包 `NOTICE` 须列明）。  
- **Git**：下载产物目录已 `.gitignore`，勿将二进制提交进本仓。
