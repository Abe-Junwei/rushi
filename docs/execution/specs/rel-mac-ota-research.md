# 调研：REL-MAC-OTA（mac unsigned + Tauri 应用内更新）

> **状态**：已采纳 · 2026-06-20  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) · grill 2026-06-20  
> **关联 spec**：[`rel-mac-ota-intent.md`](./rel-mac-ota-intent.md) · [`rel-mac-ota-plan.md`](./rel-mac-ota-plan.md) · [`rel-mac-ota-acceptance.md`](./rel-mac-ota-acceptance.md)  
> **前置**：L3 upgrade ✅（[`release-parity-l3-hand-test-checklist-2026-06-14.md`](../release-parity-l3-hand-test-checklist-2026-06-14.md)）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 个人 mac 用户首次从 GitHub Release 安装 **unsigned** `.dmg`；之后希望在应用内收到新版本并确认安装，无需每次手动找 Release |
| 本仓现状 | Tauri 2 桌面壳；`release.yml` 上传 DMG；**无** `tauri-plugin-updater`；无 Apple codesign/公证（S3）；Win 本阶段不发 Release 包（A4） |
| 成功标准 | **v0.1.2** 起 OTA 链：启动检查（UX1）→ 提示 → 下载验签 → 安装；**v0.1.1 须手动装一次 v0.1.2** |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **Tauri v2 Updater + Ed25519 manifest** | Tauri 官方 · EcoPaste 等 | `tauri-plugin-updater`；Release `latest.json` + `.sig`；与 OS codesign **独立** | [Tauri Updater v2](https://v2.tauri.app/plugin/updater/) |
| B | **tauri-action 一体化 Release** | 社区最佳实践 | CI 构建 + 上传 artifact + 生成 updater JSON | [Codegiz Tauri Patterns Ep.8](https://www.codegiz.com/blog/tauri-patterns-episode-8-self-updating-tauri-2-apps-with-signed-releases/) |
| C | **Sparkle / App Store** | mac 原生 | 需 Apple 签名或 Store 管道 | **不采用**（本阶段 unsigned） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 备注 |
|------|--------|----------|------|------|
| A Tauri updater | **高** | 现有 `release.yml`、About 页、`app_version()` | 须保管 `TAURI_SIGNING_PRIVATE_KEY`；丢失不可向旧用户推更 | **选定** |
| B tauri-action | **中** | 可渐进迁移 workflow | 当前 custom workflow 已绿 | 可选尾项 |
| C Sparkle | 低 | — | 与 unsigned 策略冲突 | 不做 |

**本仓可复用**：

- `apps/desktop/src-tauri/tauri.conf.json` bundle 配置
- `.github/workflows/release.yml` · `scripts/stage-release-artifacts.sh`
- `EnvAboutPanel` · `diagnostic.rs` `build-info.txt` 版本真源
- CONTEXT：**In-app update** / **OTA baseline version** / **Unsigned mac release**

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定** | **U1 + K1 + V1 + UX1**：unsigned DMG 首装；Ed25519 updater；**v0.1.2** OTA 起点；启动时检查并提示确认 |
| **不做什么** | Apple codesign/公证；Win Release 包；Sparkle；静默强制更新；v0.1.1 应用内升到 v0.1.2 |
| **密钥** | 用户本机 `tauri signer generate` → GitHub Secrets + `pubkey` in `tauri.conf.json` |
| **manifest** | GitHub Release 静态 `latest.json`（platform `darwin-aarch64` / 后续 x64） |
| **与 L3** | OTA 开发不重复 L3，除非改动触达 B1–B9 主路径（O1） |

---

## 5. 落位预告

| 层 | 路径 |
|----|------|
| Rust | `Cargo.toml` `tauri-plugin-updater`；`lib.rs` plugin init；`capabilities/default.json` updater 权限 |
| 配置 | `tauri.conf.json` `plugins.updater` · `bundle.createUpdaterArtifacts` |
| TS | `services/appUpdate.ts` 或 hook；`App.tsx` 启动检查 UX1；`EnvAboutPanel` 手动「检查更新」 |
| CI | `release.yml` 生成/上传 `latest.json` + `.sig`；`TAURI_SIGNING_PRIVATE_KEY` |
| 文档 | `user-guide-zh.md` §更新；About 说明 v0.1.1 须手动首装 |
| 测试 | 单测 mock updater check；acceptance 手测 v0.1.2→v0.1.3 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] K1 密钥入库后首个 OTA tag（层 1 ✅ · 待 v0.1.2 Release）

| 日期 | 说明 |
|------|------|
| 2026-06-20 | grill 拍板 + Tauri 官方对照 |
