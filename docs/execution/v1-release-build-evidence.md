# v1 发版构建证据

- **时间（UTC）**：2026-07-18T05:44:43Z
- **版本**：`1.0.1`
- **门禁**：typecheck · vitest · architecture-guard · r9-rel-1 · release-sidecar-preflight
- **bundles**：`dmg`
- **根目录安装包**：打包完成后 `*.dmg` 会复制到仓库根目录（`scripts/stage-release-artifacts.sh`）

## 产物

(no .app — check bundle path)
-rw-r--r--@ 1 junwei  staff   1.5G Jul 18 13:44 /Users/junwei/开发/Rushi/apps/desktop/src-tauri/target/release/bundle/dmg/如是我闻_1.0.1_aarch64.dmg
**DMG size**: 1.5G (1561858764 bytes)

## 说明

- **侧车**在 `.app/Contents/Resources/resources/bundled-asr/`；**默认语音模型**随包在 `resources/bundled-asr-models/`，首启 seed 至 App Data `models/`。
- **App OTA**：macOS 通过 Tauri updater 维护；Release 需包含 `latest.json` + `app.tar.gz` + `app.tar.gz.sig`（由 CI 生成）。
- 发版后机器冒烟：`bash scripts/v1-release-installed-smoke.sh`

## 发版后手测（安装包）

1. Fresh App Data 首启：全屏「正在准备内置语音模型…」→ seed 完成 → 断网可转写。
2. 导入音频 → 确认 `projects/*/peaks/*.dat` 生成 → 波形可见。
3. 拉取语段 → 导出 Word。
