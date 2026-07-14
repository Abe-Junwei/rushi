# Spec(plan): REL-MAC-OTA

> **Research**：[`rel-mac-ota-research.md`](./rel-mac-ota-research.md)  
> **Intent**：[`rel-mac-ota-intent.md`](./rel-mac-ota-intent.md)  
> **Acceptance**：[`rel-mac-ota-acceptance.md`](./rel-mac-ota-acceptance.md)

---

## 切片顺序（单人）

```text
OTA-1  依赖 + tauri.conf + capabilities + 占位 pubkey     → typecheck
OTA-2  TS：checkForUpdate + 启动 UX1 + About 手动           → 单测
OTA-3  release.yml：createUpdaterArtifacts + latest.json    → CI dry-run 文档
OTA-4  tag v0.1.2（用户 K1 secrets 就绪后）                 → H-OTA-1～2 ✅
OTA-5  tag v0.1.3 验证 v0.1.2→v0.1.3 增量                  → acceptance 签收 ✅
OTA-6  v0.1.4 + 流水线修复 + v0.1.3→v0.1.4 手测           → Go ✅ 2026-06-20
```

---

## OTA-1 Rust / 配置

| 文件 | 变更 |
|------|------|
| `apps/desktop/src-tauri/Cargo.toml` | `tauri-plugin-updater` |
| `lib.rs` | `.plugin(tauri_plugin_updater::Builder::new().build())` |
| `tauri.conf.json` | `plugins.updater.endpoints` → GitHub raw/release URL 模板；`pubkey`；`createUpdaterArtifacts: true` |
| `capabilities/default.json` | updater 相关 permission |

**endpoint（CDN 优先，GitHub 镜像清单兜底）**：

```json
"endpoints": [
  "https://updates.rushi.app/latest.json",
  "https://github.com/Abe-Junwei/rushi/releases/latest/download/latest.json"
]
```

包体 URL 写在 `latest.json` 内，指向 `https://updates.rushi.app/<tag>/app.tar.gz`（见 [`rel-mac-ota-cdn-r2.md`](./rel-mac-ota-cdn-r2.md)）。
---

## OTA-2 前端

| 文件 | 职责 |
|------|------|
| `services/appUpdate.ts` | `check()` · `downloadAndInstall()` · 错误映射中文 |
| `hooks/useAppUpdateCheckOnLaunch.ts` | 启动一次 check；UX1 confirm dialog |
| `EnvAboutPanel.tsx` | 「检查更新」按钮 + 状态文案 |
| `CompactConfirmDialog` 或现有 confirm | 新版本提示 |

**纪律**：不在 setState updater 内 DOM；busy 时不弹更新。

---

## OTA-3 CI

| 文件 | 变更 |
|------|------|
| `.github/workflows/release.yml` | **tag push `v*`** 触发；draft Release → 上传 → `publish-release` 验证 manifest 后 publish |
| `scripts/ci-ensure-draft-release.sh` | 创建 draft；空 published Release 回退 draft |
| `scripts/ci-generate-updater-latest-json.sh` | URL 固定 `app.tar.gz` |
| `scripts/ci-normalize-macos-dmg-name.sh` | DMG 统一 `rushi-desktop_X.Y.Z_aarch64.dmg` |
| `scripts/ci-verify-updater-manifest.sh` | publish 前校验 `latest.json` + `app.tar.gz` |
| `scripts/ci-publish-github-release.sh` | 全部 job 绿后 `gh release edit --draft=false` |

**禁止**：`gh release create` 先于 CI（会导致 `/releases/latest/download/latest.json` 404 空窗）。

**platform key**：`darwin-aarch64`（与 Tauri v2 一致）。

---

## OTA-4 文档

| 文件 | 内容 |
|------|------|
| `user-guide-zh.md` | §应用更新：v0.1.1 须手动首装；Gatekeeper unsigned 说明 |
| About 页 | marketing version = `app_version()` |

---

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
# K1 就绪后本地 release build 含 .sig
# H-OTA-1～3 手测（acceptance）
```

---

## 风险

| 风险 | 缓解 |
|------|------|
| 丢失 updater 私钥 | 文档强调 backup；仅新 DMG 可救 |
| unsigned 首装 Gatekeeper | user-guide 右键打开 |
| endpoint 404 | CI 上传 gate；about 显示检查失败 |

---

## 与 L3 / FLOAT-FIT

- FindReplace auto-fit 修复（layoutRev 5）**独立 PR**，不挡 OTA-1  
- OTA 合入后不重复 L3，除非启动/关于/更新 dialog 触达 B 主路径
