# REL-WIN-OTA + v1.0.0 发行签收 Runbook

> **Acceptance**：[`rel-win-ota-acceptance.md`](./rel-win-ota-acceptance.md)  
> **Research**：[`rel-win-ota-spike-research.md`](./rel-win-ota-spike-research.md)  
> **mac 联合签收**：[`v1.0.0-release-signoff-runbook.md`](./v1.0.0-release-signoff-runbook.md)（unsigned DMG + 冒烟）  
> **原则**：**C-1～C-5 全绿** 且 **H-WIN-1～4 + H-WIN-OTA-1～2** 通过前，**不得** 对外宣称 Win OTA Go。

---

## 签收头（手填）

| 字段 | 值 |
|------|-----|
| 日期 | |
| 签收人 | |
| Tag | `v` |
| 应用版本（`package.json`） | |
| Windows 机器 | Win10 / Win11 · x64 · 构建号 |
| NSIS 安装路径 | 默认 per-user / per-machine |
| CI Run URL | |
| `latest.json` version 字段 | |
| 结论 | ☐ Go · ☐ No-Go |

---

## A. 发版前：版本与机器闸门

### A.1 版本 bump（三处一致）

| 文件 | 字段 |
|------|------|
| `apps/desktop/package.json` | `"version"` |
| `apps/desktop/src-tauri/tauri.conf.json` | `"version"` |
| `apps/desktop/src-tauri/Cargo.toml` | `version` |

```bash
cd /path/to/Rushi
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

可选（Rust）：

```bash
cd apps/desktop/src-tauri && cargo test --lib && cargo clippy --lib --all-targets
```

### A.2 Secrets 核对（GitHub Repository Secrets）

| Secret | 用途 |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | mac + win updater `.sig` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 若私钥有密码 |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` | CDN 上传 |
| `R2_BUCKET` | 可选，默认 `rushi-updates` |
| `WINDOWS_*` | 可选 Authenticode；**无** 也不挡 OTA |

---

## B. 本地 Windows 预检（可选 · 在 Win 机器上）

在 **Windows x64** 仓库根目录：

```powershell
npm run release:win
```

期望产物：

| 路径 | 说明 |
|------|------|
| `windows-portable-x64.zip` | 手动渠道 |
| `apps/desktop/src-tauri/target/release/bundle/nsis/rushi-desktop-setup.exe` | OTA + 推荐首装 |
| `.../rushi-desktop-setup.exe.sig` | 需 `TAURI_SIGNING_PRIVATE_KEY` |

本地生成 fragment（需 bash + jq，Git Bash 或 WSL）：

```bash
bash scripts/ci-normalize-windows-nsis-name.sh \
  --bundle-root apps/desktop/src-tauri/target/release/bundle
bash scripts/ci-generate-updater-latest-json.sh \
  --tag vX.Y.Z \
  --platform windows-x86_64 \
  --bundle-root apps/desktop/src-tauri/target/release/bundle
```

---

## C. 打 tag · 观察 CI

```bash
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

```bash
gh run list --workflow="Release build" --limit 5
gh run watch <run-id>
```

**必须绿的 job**：

1. `tauri-macos`
2. `tauri-windows`（NSIS 不再 `continue-on-error`）
3. `verify-cdn-release`（合并 manifest + 双平台校验）

> 测 workflow 改动用 **Actions → Release build → Run workflow** on `main`；勿对旧 failed run 点 Re-run（见 `release.yml` 注释）。

---

## D. CDN 自动验收（tag 后 · 任意机器）

将 `TAG` 换成实际 tag（如 `v1.0.0`）：

```bash
export TAG=v1.0.0
export CDN=https://updates.rushi.app

# 1) 合并 manifest 已由 CI 上传 — 拉取并目检
curl -fsSL "$CDN/latest.json" | jq .

# 2) 版本与 package.json 一致
node -p "require('./apps/desktop/package.json').version"

# 3) 双平台 URL
curl -fsSL "$CDN/latest.json" | jq -r '.platforms["darwin-aarch64"].url, .platforms["windows-x86_64"].url'

# 4) 仓库脚本一键校验（含 HTTP 200）
bash scripts/ci-verify-updater-manifest.sh --tag "$TAG" --cdn-base "$CDN"
```

**期望 `latest.json` 片段**：

```json
{
  "version": "1.0.0",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://updates.rushi.app/v1.0.0/app.tar.gz",
      "signature": "..."
    },
    "windows-x86_64": {
      "url": "https://updates.rushi.app/v1.0.0/rushi-desktop-setup.exe",
      "signature": "..."
    }
  }
}
```

**期望 CDN 文件**（`<tag>` 目录）：

```text
https://updates.rushi.app/<tag>/app.tar.gz
https://updates.rushi.app/<tag>/app.tar.gz.sig
https://updates.rushi.app/<tag>/rushi-desktop-setup.exe
https://updates.rushi.app/<tag>/rushi-desktop-setup.exe.sig
https://updates.rushi.app/<tag>/windows-portable-x64.zip
https://updates.rushi.app/<tag>/<dmg>
```

---

## E. Windows 手测（Release 包 · 非开发构建）

### E.1 准备

1. 从 CDN 下载 **`rushi-desktop-setup.exe`**（勿用开发机 `target/release` 二进制代替对外签收）。
2. 干净 VM 或新用户配置文件（推荐至少 H-WIN-OTA-1 用干净环境）。
3. SmartScreen 提示时选「仍要运行」（unsigned 预期行为）。

### E.2 基础路径（H-WIN-1～4）

| 步骤 | 操作 |
|------|------|
| 1 | 运行 NSIS 安装包 → 启动应用 |
| 2 | **设置 → 关于**：版本 = tag 对应版本 |
| 3 | 新建项目 → 导入音频 → 确认波形 |
| 4 | 本机转写 → 语段出现 |
| 5 | 导出 Word → 文件可打开 |

### E.3 OTA 路径（H-WIN-OTA-1～2）

**前提**：机器上已装 **vN** NSIS 版；CDN 已发布 **vN+1**（更高 semver）。

| 步骤 | 操作 |
|------|------|
| 1 | 启动 vN 应用 |
| 2 | 等待启动检查或 **设置 → 关于 → 检查更新** |
| 3 | 确认对话框 → 下载 → 安装（Windows 会自动退出） |
| 4 | 重启后关于页版本 = vN+1 |
| 5 | 重复检查更新 → 「已是最新」 |

**OTA 增量测试快捷法**（若不想等两次 tag）：

- 在测试机保留 vN 安装；
- 仅向 CDN 上传更高版本的 `latest.json` + win/mac 包（需与生产流程一致，建议仍走完整 tag CI）。

### E.4 portable 对照（H-WIN-OTA-3 · 可选）

1. 解压 `windows-portable-x64.zip` → 运行 `rushi-desktop.exe`。
2. **检查更新**：记录行为（预期：无可靠 OTA；user-guide 指引改 NSIS）。

---

## F. 证据回填模板

复制到 `docs/execution/v1.0.0-win-ota-signoff-evidence.md`（或 PR 描述）：

```markdown
## Win OTA 签收证据 · vX.Y.Z

- **日期**：
- **CI**：<run url>
- **latest.json version**：`curl -s https://updates.rushi.app/latest.json | jq -r .version`
- **windows-x86_64 url**：`…`
- **H-WIN-1～4**：☐/✅
- **H-WIN-OTA-1**：v___ → v___ · ☐/✅
- **H-WIN-OTA-2**：☐/✅
- **备注**：
```

---

## G. 签收判定

| 级别 | 条件 |
|------|------|
| **Go** | C-1～C-5 ✅ · H-WIN-1～4 ✅ · H-WIN-OTA-1～2 ✅ |
| **No-Go** | NSIS CI 失败 · manifest 缺 `windows-x86_64` · OTA 安装后版本未变 · 主路径转写/导出失败 |

No-Go 处理：

1. 记录 Blocker 于 [`rel-win-ota-acceptance.md`](./rel-win-ota-acceptance.md) 签收表。
2. 修复后 **新 tag**（勿 force-push 已发布 tag）。
3. 重新跑 C + H。

---

## H. 命令备忘

```powershell
# 本地 Windows release 全量
npm run release:win

# 安装后日志（若启用文件日志）
Get-Content "$env:APPDATA\studio.lingchuang.rushi\logs\desktop.log" -Tail 50 -Wait
```

```bash
# mac 侧同 tag CDN 校验（联合发版时）
bash scripts/v1-release-installed-smoke.sh   # 仅 mac · 见 v1.0.0 runbook
bash scripts/ci-verify-updater-manifest.sh --tag vX.Y.Z
```

---

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-15 | 初版 · Win OTA CI 合并 manifest 后签收流程 |
