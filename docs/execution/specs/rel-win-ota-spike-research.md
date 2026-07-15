# 调研（spike）：REL-WIN-OTA — Windows 应用内更新可行性

> **状态**：已实施 · 2026-07-15  
> **签收**：[`rel-win-ota-acceptance.md`](./rel-win-ota-acceptance.md) · [`rel-win-ota-signoff-runbook.md`](./rel-win-ota-signoff-runbook.md)
> **关联**：[`rel-mac-ota-research.md`](./rel-mac-ota-research.md) · [`rel-mac-ota-cdn-r2.md`](./rel-mac-ota-cdn-r2.md) · [`win-release-assets-acceptance.md`](./win-release-assets-acceptance.md)  
> **触发**：v1.0.0 修复排期 R4；[`code-review-report-2026-07.md`](../../code-review-report-2026-07.md) P3「Windows OTA 缺失」

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Windows 10/11 x64 用户已安装 **portable zip** 或 **NSIS 安装包**；希望与 mac 一样，启动后从 `updates.rushi.app/latest.json` 收到新版本并确认安装 |
| 本仓现状 | mac OTA 已闭环（`darwin-aarch64` + `app.tar.gz` + Ed25519）；Win CI 产出 **portable zip**（手搓脚本）+ **可选 NSIS**（`continue-on-error`）；`latest.json` **无** `windows-x86_64` 条目 |
| spike 成功标准 | 给出 **GO / NO-GO / 延期** 结论、缺口清单、预估工时、首装基线策略；**不写**业务实现代码 |

---

## 2. 现状差距（代码与 CI 对照）

### 2.1 客户端 — 已跨平台，无需改

| 模块 | 现状 | Win OTA 阻塞？ |
|------|------|----------------|
| `tauri-plugin-updater` + `capabilities/desktop.json` `updater:default` | 已注册 | 否 |
| `services/appUpdate.ts` | `check()` / `downloadAndInstall()` 无 OS 分支 | 否 |
| `tauri.conf.json` `plugins.updater` | 同一 `pubkey` + `https://updates.rushi.app/latest.json` | 否 |
| `bundle.createUpdaterArtifacts` | `true`（全局） | **是** — Win CI 用 `--no-bundle` 绕过了产物生成 |

### 2.2 Windows CI — 不产出 updater 工件

```text
release.yml tauri-windows:
  npm run tauri -- build --no-bundle     ← 无 .sig
  npm run tauri -- build --bundles nsis  ← continue-on-error: true（常失败/跳过）
  手搓 windows-portable-x64.zip          ← 非 Tauri updater 格式
  ci-upload-updater-cdn.sh --mode windows ← 只上传 zip/NSIS 到 /<tag>/，不写 latest.json
```

对比 mac：

```text
release.yml tauri-macos:
  npm run tauri -- build --bundles app,dmg
  规范化 app.tar.gz + app.tar.gz.sig
  ci-generate-updater-latest-json.sh --platform darwin-aarch64
  ci-upload-updater-cdn.sh --mode macos-ota  ← 写 latest.json
```

### 2.3 manifest — 仅 mac 平台

| 脚本 | 行为 |
|------|------|
| `ci-generate-updater-latest-json.sh` | 硬编码 `PLATFORM=darwin-aarch64`，只读 `macos/app.tar.gz` |
| `ci-verify-updater-manifest.sh` | 只校验 `platforms.darwin-aarch64` + `app.tar.gz` HTTP 200 |
| CDN `latest.json`（生产） | 预期仅含 mac 条目（[`rel-mac-ota-cdn-r2.md`](./rel-mac-ota-cdn-r2.md)） |

### 2.4 首装形态与 updater 工件不匹配

| 首装方式 | 当前分发 | Tauri updater 可消费？ |
|----------|----------|------------------------|
| portable zip（`rushi-desktop.exe` + `resources/`） | ✅ 主路径 | **否** — 非 `.exe.sig` / NSIS updater 包 |
| NSIS `*-setup.exe` | ⚠️ 可选、常失败 | **是** — Tauri v2 直接下载 `*-setup.exe` + `.sig` 并以 `/UPDATE` 安装 |

Tauri v2（`createUpdaterArtifacts: true`）在 Windows 上生成：

- `bundle/nsis/*-setup.exe` + `*-setup.exe.sig`（推荐；与官方文档一致）
- 可选 `bundle/msi/*.msi` + `.sig`

参考：[Tauri Updater v2 — Windows artifacts](https://v2.tauri.app/plugin/updater/)

**结论**：Win OTA 必须以 **NSIS 安装包** 为更新载体；portable zip 不能作为 updater payload，除非自研增量替换（超出 Tauri 能力）。

---

## 3. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 与 Rushi 关系 |
|---|------|------|----------|---------------|
| A | **Tauri v2 Updater + NSIS + Ed25519** | Tauri 官方 · tauri-action | 与 mac 共用 `latest.json` + 同一 `pubkey`；`windows-x86_64` 指向 `*-setup.exe` URL + inline signature | **选定（若做 Win OTA）** |
| B | **仅手动 portable / NSIS 下载** | 当前 Win 发行 | CDN `/<tag>/windows-portable-x64.zip`；无 manifest 条目 | **当前 v1.0.0 默认** |
| C | **Squirrel / WinSparkle** | Electron 系 | 独立更新框架 + 自有 delta | **不采用** — 与 Tauri updater 重复 |

---

## 4. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 / 缺口 |
|------|--------|----------|-------------|
| A Tauri NSIS OTA | **高** | mac OTA 全栈（`appUpdate.ts`、R2 CDN、Ed25519 secrets、`desktop.json` capability） | ① Win CI 改 bundle 策略 ② manifest 多平台合并 ③ 首装从 portable 迁到 NSIS 基线 ④ NSIS 构建稳定性 |
| B 手动下载 | **高** | 现有 `release.yml` + `win-release-assets-acceptance.md` | 用户每次找 CDN/Release |
| C 自研 | 低 | — | 禁止第二套 OTA 栈 |

**本仓可复用模块**：

- `scripts/ci-upload-updater-cdn.sh` — 扩展 `macos-ota` 或新增 `windows-ota` mode
- `scripts/ci-generate-updater-latest-json.sh` — 参数化 platform + artifact 路径
- `verify-cdn-release` job — 天然适合「双平台 job 完成后合并 manifest」
- `APP_UPDATE_OTA_BASELINE_VERSION` — 可扩为 per-OS 或统一 `1.0.0`（新 Win 用户首装即 NSIS）

---

## 5. 决策摘要（spike 结论）

| 问题 | 结论 |
|------|------|
| **技术可行性** | **GO** — Tauri v2 官方支持 `windows-x86_64`；客户端与密钥已就绪；缺口仅在 **CI 产物 + manifest** |
| **v1.0.0 是否必须做** | **NO（建议 v1.0.0 仍手动 Win 更新）** — NSIS 构建当前 `continue-on-error`、portable 与 OTA 载体不一致；强行并入 v1.0.0 签收会拉长关键路径 |
| **推荐排期** | **v1.0.1 薄片**（估 **2～3 人日** 编码 + **0.5 人日** Win 真机 OTA 手测） |
| **不做什么** | portable zip 作为 updater payload；第二套 Squirrel/WinSparkle；为 Win OTA 单独换 Ed25519 密钥 |
| **首装基线策略（若启用 Win OTA）** | 新用户首装改为 **NSIS `*-setup.exe`**（CDN）；已装 portable 的 v1.0.0 用户须 **手动装一次 NSIS 版** 后进入 OTA 链（对齐 mac「v0.1.1→v0.1.2 手动首跳」） |
| **unsigned 策略** | Tauri Ed25519 验签与 Authenticode **独立**；unsigned NSIS 仍有 SmartScreen 警告 — 与当前 unsigned Win 发行决策一致，**不阻塞** OTA |
| **Authenticode** | 可选增强（减 SmartScreen）；**非** Win OTA 硬依赖 |

---

## 6. 若 GO — 最小实现蓝图（v1.0.1 预估）

### 6.1 CI / 脚本（~1.5 人日）

| 步骤 | 文件 | 变更 |
|------|------|------|
| W1 | `release.yml` `tauri-windows` | 去掉 `--no-bundle` 主路径；`build --bundles nsis` **必填**（移除 `continue-on-error` 或拆为 gate job）；保留 portable zip 作**手动**首装备选 |
| W2 | `ci-generate-updater-latest-json.sh` | 支持 `--platform windows-x86_64` + `--artifact nsis-setup.exe`；或输出单平台 fragment |
| W3 | 新 `ci-merge-updater-manifest.sh` | 在 `verify-cdn-release` 合并 `darwin-aarch64` + `windows-x86_64` 为单一 `latest.json` 再上传 R2 |
| W4 | `ci-upload-updater-cdn.sh` | 新增 `windows-ota`：`/<tag>/*-setup.exe` + `.sig` |
| W5 | `ci-verify-updater-manifest.sh` | 校验 `windows-x86_64.url` / signature + HTTP 200 |
| W6 | `rel-mac-ota-cdn-r2.md` | CDN 布局补 `/<tag>/*-setup.exe` + `.sig` |

### 6.2 产品 / 文档（~0.5 人日）

| 步骤 | 文件 | 变更 |
|------|------|------|
| W7 | `win-release-assets-acceptance.md` | 增加 H-WIN-OTA-1/2；首装基线说明 |
| W8 | `user-guide-zh.md` | Win：NSIS 首装 + 应用内更新；portable 用户一次性迁移说明 |
| W9 | `appUpdate.ts` | 可选：Win baseline 文案区分（非必须 — 统一 baseline 即可） |

### 6.3 手测清单（Win 10/11 x64）

| ID | 步骤 | 期望 |
|----|------|------|
| H-WIN-OTA-1 | 安装 NSIS vN；CDN 发布 vN+1 manifest | 启动后提示更新；确认后安装并重启 |
| H-WIN-OTA-2 | 验签失败包 / 404 manifest | 中文错误，不 crash |
| H-WIN-OTA-3 | portable vN 用户 | 关于页「检查更新」在 baseline 前给手动安装指引（若 baseline < 当前） |

---

## 7. 风险与未决项

| 风险 | 等级 | 缓解 |
|------|------|------|
| NSIS bundle 在 CI 间歇失败 | **高** | spike 后先跑 2～3 次 tag release 稳定 NSIS，再开 OTA |
| 安装包体积（侧车 + Plan B 模型） | 中 | 与 portable 相同；CDN 带宽可接受 |
| portable → NSIS 用户迁移摩擦 | 中 | 文档 + About 文案；v1.0.0 仍提供 portable |
| `latest.json` 双平台合并竞态 | 低 | 仅在 `verify-cdn-release`（双 job success 后）合并上传 |
| 需管理员权限安装 | 低 | 默认 `installMode: passive`（Tauri 默认）；per-user 安装需在 `tauri.conf` 显式配置 |

**未决（需产品确认，非 spike 阻塞）**：

1. v1.0.0 是否同时提供 NSIS 首装入口，还是 v1.0.1 才切换「推荐 NSIS」？
2. portable zip 是否在 OTA 启用后降为「高级/离线」渠道？
3. Win OTA baseline 版本：统一 `1.0.0` 还是 `1.0.1`（首版带 OTA 的 NSIS）？

---

## 8. spike 签收

| 项 | 结论 |
|----|------|
| 技术可行 | ✅ |
| v1.0.0 关键路径实施 | ✅ CI + manifest 已编码（待 tag release 手测签收） |
| 客户端改动 | 无硬需求 |
| 主要工作量 | CI + manifest 合并 + NSIS 稳定性 + 手测 |
| 下一步 | tag release → H-WIN-OTA-1～3 手测签收 |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-15 | R4 spike：对照 Tauri 2.11.5 文档 + 本仓 release 流水线；结论 GO deferred |
| 2026-07-15 | 实施：NSIS 必填、`windows-ota` CDN、`ci-merge-updater-manifest.sh`、双平台 verify |
