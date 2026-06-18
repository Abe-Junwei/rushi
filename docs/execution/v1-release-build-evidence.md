# v1 发版构建证据

- **时间（UTC）**：2026-06-17T18:14:12Z
- **版本**：`0.1.0`
- **门禁**：typecheck · vitest · architecture-guard · r9-rel-1 · release-sidecar-preflight
- **bundles**：`app`
- **根目录安装包**：打包完成后 `*.dmg` 会复制到仓库根目录（`scripts/stage-release-artifacts.sh`）

## 产物

total 0
drwxr-xr-x@ 5 junwei  staff   160B  6月 18 02:14 Contents
(no .dmg — 可仅发 .app 或检查磁盘/rw.*.dmg)

## 说明

- **侧车**在 `.app/Contents/Resources/resources/bundled-asr/`；**语音模型**在 App Data `models/`，不在安装包内。
- **Runtime manifest（可选）**：发 OTA / 瘦包前设置 `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL` 再 build；见 [`r3h-1-r-release-checklist.md`](./specs/r3h-1-r-release-checklist.md)
- 发版后机器冒烟：`bash scripts/v1-release-installed-smoke.sh`

## 发版后手测（安装包）

1. 安装/打开 `.app`，环境页「一键准备本机 ASR」（无 shell）。
2. 导入音频 → 确认 `projects/*/peaks/*.dat` 生成 → 波形可见。
3. 拉取语段 → 导出 Word。
