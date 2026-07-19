# Spec(acceptance): REL-WIN-OTA

> **Research**：[`rel-win-ota-spike-research.md`](./rel-win-ota-spike-research.md)  
> **Runbook**：[`rel-win-ota-signoff-runbook.md`](./rel-win-ota-signoff-runbook.md)  
> **Win 发行**：[`win-release-assets-acceptance.md`](./win-release-assets-acceptance.md)  
> **CDN**：[`rel-mac-ota-cdn-r2.md`](./rel-mac-ota-cdn-r2.md)

---

## 目标

在 **unsigned Windows** 前提下，为 **v1.0.0+** 提供与 mac 共用的 **Tauri 应用内更新**（Ed25519 + `latest.json` 中 `windows-x86_64` 条目）。

| 项 | 结论 |
|----|------|
| 首装推荐 | CDN `/<tag>/如是我闻_<ver>_Windows_x64_离线安装包.zip`（完整解压后装同级 NSIS） |
| 便携版 | **已退役**（2026-07-19 路线三）；勿再发/勿再验 |
| OTA 载体 | 瘦 NSIS（`*_安装包.exe` + `.sig`）；缺旁路时 POSTINSTALL 静默跳过模型拷贝 |
| OTA baseline | 与 mac 共用 `APP_UPDATE_OTA_BASELINE_VERSION`（当前 `0.1.2`）；已装 NSIS 用户可直接 OTA |
| Authenticode | 可选；**非** OTA 硬依赖 |

---

## 机器门禁（编码侧 · 发版前）

- [ ] `tauri-plugin-updater` + `capabilities/desktop.json` `updater:default`
- [ ] `release.yml`：`tauri-windows` 产出 NSIS + `.sig` + `updater-fragment.json`
- [ ] `verify-cdn-release`：合并 `latest.json` 含 `darwin-aarch64` + `windows-x86_64`
- [ ] `ci-verify-updater-manifest.sh` 双平台 HTTP 200
- [ ] `npm run typecheck` · `npm run test` · `check-architecture-guard` 无回归
- [ ] GitHub Secrets：`TAURI_SIGNING_*` · `R2_*` 已配置

---

## CDN / CI 签收（tag 推送后）

| ID | 检查项 | 命令 / 期望 | 结果 |
|----|--------|-------------|------|
| C-1 | Release workflow 全绿 | `gh run list --workflow=release.yml --limit 3` · `tauri-macos` + `tauri-windows` + `verify-cdn-release` success | ☐ |
| C-2 | `latest.json` 可达 | `curl -fsSL https://updates.rushi.app/latest.json \| jq .version,.platforms` | ☐ |
| C-3 | Win 平台条目 | `jq -r '.platforms["windows-x86_64"].url'` → `.../vX.Y.Z/*_安装包.exe` | ☐ |
| C-4 | Win 安装包 HTTP 200 | `curl -fsSIL "<url>"` → 200 | ☐ |
| C-5 | 本地校验脚本 | `bash scripts/ci-verify-updater-manifest.sh --tag vX.Y.Z` | ☐ |
| C-6 | 离线安装包 CDN | `https://updates.rushi.app/<tag>/*_离线安装包.zip` 可下载 | ☐ |
| C-7 | NSIS OTA 包 CDN | `https://updates.rushi.app/<tag>/*_安装包.exe` + `.sig` 可下载 | ☐ |

---

## H-WIN 基础手测（离线包首装）

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-1 | CDN 下载离线 zip，完整解压后装同级 `*_安装包.exe` | 安装完成 · Plan B 释放 · 应用可启动 | ☐ |
| H-WIN-2 | 关于页版本 | 与 `package.json` / Release tag 一致 | ☐ |
| H-WIN-3 | 导入音频 → 波形 → 本机转写 | 侧车 OK · 语段可见 | ☐ |
| H-WIN-4 | 导出 Word | 成功 | ☐ |

---

## H-WIN-OTA 手测

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-OTA-1 | 已装 vN NSIS；CDN 发布 vN+1（更高 `latest.json` version） | 启动后提示更新 → 确认 → 安装 → 重启后版本为 vN+1 | ☐ |
| H-WIN-OTA-2 | 关于 → **检查更新**（manifest 无更新） | 提示已是最新；busy 时不重复弹窗 | ☐ |
| H-WIN-OTA-3 | OTA 瘦包无旁路模型 | 不 Abort；壳/侧车升级；App Data 模型仍可用 | ☐ |
| H-WIN-OTA-4 | 断网 / manifest 404 | 中文错误 · 不 crash | ☐ |
| H-WIN-OTA-5 | 篡改签名（可选） | 验签失败 · 拒绝安装 | ☐ |

---

## 能力—UI 状态矩阵（与 mac 共用）

| 状态 | Updater 未配置 / baseline 以下 | 检查中 | 有新版本 | 安装中 | 失败 |
|------|-------------------------------|--------|----------|--------|------|
| 启动 | 跳过或 about 文案 | — | Confirm 对话框 | 进度/禁用重复 | Toast |
| 关于页 | 手动安装指引 | loading | 同左 | 同左 | 错误行 |

---

## 发版命令

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
# 版本 bump commit 到 main 后：
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
# 等待 Actions：tauri-macos → tauri-windows → verify-cdn-release
```

---

## 签收

| 项 | 结论 |
|----|------|
| REL-WIN-OTA Go | ☐ |
| 首个 Win OTA tag | ☐ v_______ |
| Blocker | — |

**签收人 / 日期 / 机器**：见 [`rel-win-ota-signoff-runbook.md`](./rel-win-ota-signoff-runbook.md) 头部。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-15 | 初版 · spike 实施后签收模板 |
