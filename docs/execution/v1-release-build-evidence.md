# v1 个人单机发版构建证据

> **状态**：✅ **构建成功** · 安装冒烟 ✅（[installed-signoff](./v1-release-installed-signoff-2026-06.md)）

## 门禁（构建前）

| 项 | 结果 |
|----|------|
| `npm run typecheck` | ✅ |
| `npm run test`（desktop） | ✅ 749 |
| `check-architecture-guard.mjs` | ✅ 0 错误 |
| `r9-rel-1-machine-gate.sh` | ✅（构建脚本内；单独跑时 ASR 可选） |

## 构建命令

```bash
cd apps/desktop && npm run tauri -- build
```

等价：`bash scripts/v1-personal-release-build.sh`（含门禁 + 写本文件）。

## 产物（macOS arm64）

| 文件 | 路径 |
|------|------|
| **.app** | `apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app` |
| **.dmg** | `apps/desktop/src-tauri/target/release/bundle/dmg/如是我闻_0.1.0_aarch64.dmg` |

- **版本**：`0.1.0`（`tauri.conf.json` / `@rushi/desktop`）
- **侧车**：发布 `.app` 内 **`bundled-asr/rushi-asr-sidecar` ~989MB**（仓库 `resources/` 源目录可能仅 README，构建时本机已有 onedir）；冒烟见 `bundled_sidecar_health_ok`

## 发版后手测（安装包，必做）

1. 双击 `.dmg` 安装，打开 **如是我闻**。
2. **环境** → 本机 ASR 引导 + 默认模型（零终端）。
3. 导入或打开项目 → **拉取语段**（建议 Paraformer + 长音频抽检一条）。
4. **导出** → 干净稿 DOCX → Word 打开。
5. **质量概览** → 可见 eval 摘要（或再跑 R4-GATE）。

## 可选增强（非本次阻塞）

- 内嵌侧车：`bash scripts/build-asr-sidecar-unix.sh` 后重跑 `tauri build`（离线首启更快，体积显著增大）。
- 代码签名 / 公证：见 `docs/architecture/asr-sidecar-funasr-policy.md`、Windows `windows-release-checklist.md`。
