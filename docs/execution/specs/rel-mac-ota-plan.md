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
OTA-5  tag v0.1.3 验证 v0.1.2→v0.1.3 增量                  → acceptance 签收  ← 发版中
```

---

## OTA-1 Rust / 配置

| 文件 | 变更 |
|------|------|
| `apps/desktop/src-tauri/Cargo.toml` | `tauri-plugin-updater` |
| `lib.rs` | `.plugin(tauri_plugin_updater::Builder::new().build())` |
| `tauri.conf.json` | `plugins.updater.endpoints` → GitHub raw/release URL 模板；`pubkey`；`createUpdaterArtifacts: true` |
| `capabilities/default.json` | updater 相关 permission |

**endpoint 示例**（按 repo 定稿）：

```json
"endpoints": [
  "https://github.com/Abe-Junwei/rushi/releases/latest/download/latest.json"
]
```

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
| `.github/workflows/release.yml` | `TAURI_SIGNING_PRIVATE_KEY` env；上传 `latest.json` + `.sig` + dmg |
| `scripts/stage-release-artifacts.sh` | 可选：校验 updater 产物存在 |

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
