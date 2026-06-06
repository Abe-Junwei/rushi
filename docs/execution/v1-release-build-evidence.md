# v1 发版构建证据

- **时间（UTC）**：2026-06-06T09:46:24Z
- **版本**：`0.1.0`
- **门禁**：typecheck · vitest · architecture-guard · r9-rel-1 · release-sidecar-preflight
- **bundles**：`app`

## 产物

total 0
drwxr-xr-x  5 junwei  staff   160B  6月  6 17:46 Contents
(no .dmg — 可仅发 .app 或检查磁盘/rw.*.dmg)

## 说明

- **侧车**在 `.app/Contents/Resources/resources/bundled-asr/`；**语音模型**在 App Data `models/`，不在安装包内。
- 发版后机器冒烟：`bash scripts/v1-release-installed-smoke.sh`

## 发版后手测（安装包）

1. 安装/打开 `.app`，环境页「一键准备本机 ASR」（无 shell）。
2. 导入音频 → 确认 `projects/*/peaks/*.dat` 生成 → 波形可见。
3. 拉取语段 → 导出 Word。
