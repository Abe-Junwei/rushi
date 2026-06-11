# R3h-1-R — 发行清单（Runtime Manifest）

> **前置**：Phase R0 本地 fixture 手测 ✅  
> **签收**：R1 + R2 手测 ✅（2026-06-10 · [`r3h-1-r-phase-signoff-2026-06.md`](./r3h-1-r-phase-signoff-2026-06.md)）  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.2 **②-R**

---

## 1. 发布侧车 artifact

- [x] 构建侧车：`npm run asr:build-sidecar-unix`（或 Windows ps1）
- [x] 通过 smoke：`bash scripts/release-sidecar-preflight.sh`
- [x] 将 onedir 打成 zip（与 `prepare-local-runtime-fixtures.sh` 同结构：`rushi-asr-sidecar/` 为 zip 根）

## 2. 生成并上传 signed manifest

```bash
# Release（私钥不进仓库）
export RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX="<Ed25519 私钥 hex，对应 rushi-runtime-release-v1>"
bash scripts/publish-runtime-manifest.sh \
  --zip dist/rushi-asr-sidecar-darwin-arm64.zip \
  --artifact-url "https://<CDN>/rushi/runtime/stable/rushi-asr-sidecar-darwin-arm64.zip"
```

- [x] 上传 **zip** 至 `artifact-url`（HTTPS）— `runtime-v0.1.0` · darwin-arm64
- [x] 上传 **`dist/runtime-manifest/rushi-runtime-manifest.json`** 至稳定 channel（HTTPS）
- [x] 归档 `publish-meta.json`（sha256、版本、平台）至发版证据目录

本地 fixture 签名（仅开发）：

```bash
bash scripts/publish-runtime-manifest.sh --dev-fixture \
  --zip fixtures/local-runtime/darwin-arm64/healthy/*.zip \
  --artifact-url "https://example.invalid/asr.zip"
```

## 3. 编译期注入默认 manifest URL

桌面壳在 **未**设置 `RUSHI_LOCAL_RUNTIME_MANIFEST_URL` 时使用编译期默认值：

```bash
export RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL="https://<CDN>/rushi/runtime/stable/rushi-runtime-manifest.json"
npm run desktop:build-dmg
# 或
bash scripts/v1-personal-release-build.sh
```

落位：`local_runtime/catalog/config.rs` → `option_env!("RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL")`。

- [x] Release CI：`.github/workflows/release.yml` 在 `release` 事件打包 zip → `publish-runtime-manifest` → 注入 `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL` → 上传 `rushi-asr-sidecar-<platform>.zip` + `rushi-runtime-manifest-<platform>.json`（secret `RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX` ✅）
- [ ] **首次 CI 跑通**：Publish release 后核对 Release 页资产 + macOS job 日志中 `manifest_url=`
- [ ] 本地发版：export `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL` 后再 `tauri build`（可选；fat 包不强制）
- [x] 安装包内 **不**含 manifest 私钥；仅 HTTPS URL + pinned 公钥验签

## 4. Phase R1 手测（干净 VM）

- [x] **无 bundled** 测试包（或 `RUSHI_SKIP_BUNDLED_ASR=1`）+ **无** runtime env 覆盖
- [x] 环境 → 本机 ASR → 安装向导 → 「下载 / 修复」可用（非「manifest 未配置」）
- [x] 下载完成 → `/health` OK → 可转写（零终端）
- [x] **损坏可恢复**：删 `funasr/version.txt` → 诊断 corrupt → 重下修复（HTTPS 真源上复验）

## 5. Phase R2 手测（产品串联）

- [x] bundled / 8741 已 OK 时侧车区 informational、默认折叠（非 blocking）
- [x] 无 bundled + 空 `local_runtime` → **一键准备** 自动 manifest 下载并完成

## 6. 签收

- [x] remediation §11 子集：零终端、构建 smoke、损坏可恢复、发行信任 — 在 **HTTPS 真源** 上全绿（macOS arm64）
- [x] 路线图 **R3h-1-R** → ✅；**R3h-1** 整体 → ✅（编码 + 发行）

---

## 7. 与 fat 包策略并存

当前 Mac DMG **仍含 bundled-asr**；manifest 主价值为 **OTA / 损坏修复 / 未来瘦包**。bundled 正常时 UI 应 informational（Phase R2 ✅）。

---

*2026-06-10 · R3h-1-R R1+R2 签收*
