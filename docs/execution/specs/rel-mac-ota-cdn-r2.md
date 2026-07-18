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
https://updates.rushi.app/latest.json          # 仅双平台齐全时覆盖（darwin-aarch64 + windows-x86_64）
https://updates.rushi.app/<tag>/app.tar.gz
https://updates.rushi.app/<tag>/app.tar.gz.sig
https://updates.rushi.app/<tag>/<dmg>
https://updates.rushi.app/<tag>/如是我闻_<ver>_Windows_x64_安装包.exe
https://updates.rushi.app/<tag>/如是我闻_<ver>_Windows_x64_安装包.exe.sig
https://updates.rushi.app/<tag>/如是我闻_<ver>_Windows_x64_便携版.zip
```

**OTA 闸门（2026-07-19）**：安装物可单侧上 CDN；`latest.json` **必须** mac+win fragment 均含完整 `url`+`signature` 才上传（Tauri 校验整份静态 JSON）。缺一侧则 **保留旧 latest.json**。合并脚本：`ci-merge-updater-manifest.sh --require-platforms darwin-aarch64,windows-x86_64`。

## Secrets

| Secret | 说明 |
|--------|------|
| `R2_ACCESS_KEY_ID` | R2 API token（须 **Object Read & Write**，勿用只读） |
| `R2_SECRET_ACCESS_KEY` | Secret |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`（**勿**带桶名；Cloudflare 桶页 S3 API 常显示为 `…/rushi-updates`，Secret 里要去掉末尾 `/rushi-updates`。CI 会自动 strip。若误带桶名，对象会进嵌套前缀 `s3://rushi-updates/rushi-updates/`，可用 `scripts/ci-r2-unnest-bucket-prefix.sh` 或 workflow「CDN verify from artifacts」搬回根路径） |
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
