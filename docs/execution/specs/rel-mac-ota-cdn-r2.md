# 运维：桌面 OTA 走 Cloudflare R2 CDN（updates.rushi.app）

> **状态**：已落地配置 · 2026-07-14  
> **关联**：[`rel-mac-ota-plan.md`](./rel-mac-ota-plan.md) · Tauri `plugins.updater`

## 架构

```text
客户端 check()
  → https://updates.rushi.app/latest.json          （主）
  → GitHub releases/.../latest.json                （清单镜像兜底）
  → platforms.*.url = https://updates.rushi.app/<tag>/app.tar.gz
验签：既有 TAURI_SIGNING_PRIVATE_KEY / pubkey
```

| 对象 | 路径 |
|------|------|
| 当前清单 | `/latest.json` |
| 版本包 | `/<tag>/app.tar.gz` |
| 签名 | `/<tag>/app.tar.gz.sig` |
| 清单归档 | `/<tag>/latest.json` |

桶名：`rushi-updates` · 自定义域：`updates.rushi.app`

## GitHub Actions Secrets（必填）

在仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 值 |
|--------|-----|
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`（截图里 S3 API 主机，**不要**带桶名路径） |
| `R2_BUCKET` | 可选，默认 `rushi-updates` |

Token 权限：该桶的 Object Read & Write。

## 本地/发版脚本

```bash
# 生成清单（包体 URL 指向 CDN）
bash scripts/ci-generate-updater-latest-json.sh --tag v0.1.9 --bundle-root … 

# 上传 R2
export R2_ACCESS_KEY_ID=…
export R2_SECRET_ACCESS_KEY=…
export R2_ENDPOINT=https://….r2.cloudflarestorage.com
bash scripts/ci-upload-updater-cdn.sh --tag v0.1.9 --bundle-root …

# 校验（Release 资产 + CDN 200）
bash scripts/ci-verify-updater-manifest.sh --tag v0.1.9 --repository Abe-Junwei/rushi
```

## 客户端

`apps/desktop/src-tauri/tauri.conf.json` → `plugins.updater.endpoints` 已含 CDN 优先。  
**已安装旧版**仍指向 GitHub：须至少升级到含本配置的版本后，后续更新才走 CDN（或手动装一版新 DMG）。

## 首装 / 手动下载

`.dmg` 仍可走 GitHub Releases；CDN 专供应用内 OTA。
