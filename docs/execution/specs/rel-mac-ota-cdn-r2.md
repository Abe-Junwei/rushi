# 运维：桌面发版只上 Cloudflare R2 CDN（updates.rushi.app）

> **状态**：已落地 · 2026-07-14  
> **关联**：[`rel-mac-ota-plan.md`](./rel-mac-ota-plan.md) · Tauri `plugins.updater`

## 原则

- **安装包与 OTA 只发布到 CDN**（R2 桶 `rushi-updates`）。
- **不再** `gh release upload` 安装包 / updater 资产。
- 客户端 updater endpoint 仅：`https://updates.rushi.app/latest.json`。
- GitHub Actions 仍用 tag 触发构建；`workflow_dispatch` 可把产物留在 Actions Artifact（非 Release）。

## CDN 布局

```text
https://updates.rushi.app/latest.json          # 合并 darwin-aarch64 + windows-x86_64
https://updates.rushi.app/<tag>/app.tar.gz
https://updates.rushi.app/<tag>/app.tar.gz.sig
https://updates.rushi.app/<tag>/<dmg>
https://updates.rushi.app/<tag>/rushi-desktop-setup.exe
https://updates.rushi.app/<tag>/rushi-desktop-setup.exe.sig
https://updates.rushi.app/<tag>/windows-portable-x64.zip
```

`latest.json` 由 `verify-cdn-release` job 在 mac + win 双平台 fragment 合并后上传（见 [`rel-win-ota-spike-research.md`](./rel-win-ota-spike-research.md)）。

## Secrets

| Secret | 说明 |
|--------|------|
| `R2_ACCESS_KEY_ID` | R2 API token（须 **Object Read & Write**，勿用只读） |
| `R2_SECRET_ACCESS_KEY` | Secret |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`（勿带桶名路径） |
| `R2_BUCKET` | 可选，默认 `rushi-updates` |
| `TAURI_SIGNING_*` | OTA 签名（不变） |

上传大文件走 multipart：`CreateMultipartUpload` 报 `AccessDenied` 时优先检查 API token 权限与桶名，而不是重打 sidecar。

## 脚本

- `scripts/ci-generate-updater-latest-json.sh` — 单平台 updater fragment
- `scripts/ci-merge-updater-manifest.sh` — 合并 fragment → `latest.json`
- `scripts/ci-normalize-windows-nsis-name.sh` — NSIS 稳定文件名
- `scripts/ci-upload-updater-cdn.sh --mode macos-ota|macos-dmg|windows|windows-ota|manifest`
- `scripts/ci-verify-updater-manifest.sh` — 校验 mac + win CDN 包与 manifest

## 发版步骤

```bash
# 版本号已写入 package.json / tauri.conf / Cargo.toml 后：
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
# 等待 Actions → Release build → verify-cdn-release 绿
```

下载入口改为 CDN，例如 mac：`https://updates.rushi.app/v1.0.0/…dmg`（具体文件名以构建产物为准）。
