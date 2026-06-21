# R3h-1-R：侧车 Runtime Manifest 发行激活

> **历史状态**：v0.1.8 起已停止 runtime manifest / 侧车 OTA zip；当前为 Plan B（随包模型）。本文档仅保留历史记录。

> **状态**：✅ R0 / R1 / R2 手测签收（2026-06-10）· Release CI 编码 ✅（2026-06-11）  
> **签收**：[`r3h-1-r-phase-signoff-2026-06.md`](./r3h-1-r-phase-signoff-2026-06.md)  
> **路线图索引**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.2 **②-R**、§4.1.5.2  
> **实施真源（LRC 背景）**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) §5 Phase 1、§11  
> **关联**：[`r3f-asr-setup-wizard-acceptance.md`](./r3f-asr-setup-wizard-acceptance.md)（一键准备在缺侧车时须消费本轨）

---

## 1. 问题陈述

**R3h-1 编码**已在 `apps/desktop/src-tauri/src/local_runtime/` 落地：signed manifest 解析、Ed25519 验签（release key `rushi-runtime-release-v1` pinned）、HTTPS 策略、下载 → staging → sha256 → `app_data/local_runtime/`、current/previous 回滚、UI「下载 / 修复」。

**发行缺口**：生产安装包**未**提供默认 manifest 源。今日仅当进程环境存在 `RUSHI_LOCAL_RUNTIME_MANIFEST_URL` 时，「应用内下载 / 修复侧车」才可用；未配置时 UI 显示「未配置 manifest」，但 **bundled / dev `python -m rushi_asr` / 8741 已有服务** 仍可转写。

**本轨目标**：让 **LRC 侧车 manifest** 对发行用户产生真实价值，而不改变「侧车运行时 vs 语音模型权重」分离架构。

> **勿混淆**：`RUSHI_MODEL_VERIFY_MANIFEST` 是**模型权重** SHA256 校验（R3c 展示）；本轨只管 **~2GB 侧车 onedir zip** 的 `rushi-runtime-manifest.json`。

---

## 2. 侧车来源与 manifest 作用面

| 来源 | 是否需要 runtime manifest | 典型场景 |
|------|---------------------------|----------|
| **bundled-asr**（安装包内 PyInstaller） | 否 | 当前 Mac DMG；离线可用 |
| **dev `python -m rushi_asr`** | 否 | `desktop:dev`、`RUSHI_SKIP_BUNDLED_ASR=1` |
| **8741 已有外部进程** | 否 | 端口占用 / 手动起服务 |
| **app_data 应用内下载** | **是** | 瘦包、bundled 损坏修复、侧车 OTA |

启动候选合并见 `asr_sidecar/candidates.rs`：`local_runtime` 已安装 exe 与 bundled 并列尝试。

---

## 3. 三阶段激活（推荐实施顺序）

### Phase R0 — 本地验通（~1d，不阻塞发版）

| 步骤 | 内容 |
|------|------|
| 脚本 | `bash scripts/prepare-local-runtime-fixtures.sh` |
| 环境 | `RUSHI_LOCAL_RUNTIME_MANIFEST_URL` + `RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST=1` |
| 手测 | 无 bundled、空 `app_data/local_runtime` → UI「下载 / 修复」→ `/health` OK |
| 验收 | remediation §11 手测 1–3（healthy install / corrupt repair / bundled offline fallback） |

### Phase R1 — 最小发行闭环（~1w，**R3h-1-R 签收**）

**A. 发布流水线**

1. 各平台构建侧车 zip（`npm run asr:build-sidecar-unix` / Windows ps1；与 **Q-SIDECAR-1** Mac 手动策略一致）。
2. 计算 artifact `sha256`、`size_bytes`；写入 manifest `components[]`（schema 真源：`local_runtime/manifest/` tests + remediation §3.4）。
3. 用 **release 私钥**（对应壳内 `rushi-runtime-release-v1`）Ed25519 签名 manifest；**私钥不进仓库**，CI secret 保管。
4. 上传 manifest + zip 至 **HTTPS**（GitHub Releases / 对象存储 + CDN）；可选 `mirror_urls[]`。
5. 流水线 **post-build smoke**：起侧车 → `/health` 200 且 `funasr_import_ok`。

**待建仓库资产**（本轨交付物）：

- ✅ `scripts/publish-runtime-manifest.sh`：hash → sign → 输出 manifest（HTTPS 上传仍须 CI / 手工）
- ✅ [`r3h-1-r-release-checklist.md`](./r3h-1-r-release-checklist.md)
- ✅ 编译期默认 URL：`config.rs` + `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL`
- [x] Release CI：`.github/workflows/release.yml` + `scripts/ci-publish-runtime-manifest-release.sh`（per-platform manifest；secret `RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX`）

**B. 桌面壳默认 manifest 源**

| 方案 | 说明 | 推荐 |
|------|------|------|
| **B1 编译期 HTTPS 默认 URL** | `configured_manifest_source()`：env 为空时 fallback 到 stable channel URL | **v1 首选** |
| **B2 resources 内置 + HTTPS 更新** | 首次离线可读本地 manifest；OTA 拉 HTTPS | 可与 B1 组合 |

落位：`apps/desktop/src-tauri/src/local_runtime/catalog/config.rs`；Release 构建注入 channel URL（stable / beta 可分支）。

**C. 发行门禁（remediation §11 _subset_）**

- [ ] **零终端**：干净 VM、**无 bundled**、仅默认 manifest → 首次转写成功（不执行 pip/bash）。
- [ ] **构建 smoke**：每平台 artifact 在 CI 跑 health。
- [ ] **损坏可恢复**：corrupt → 诊断 → 应用内重下（已有手测，需在 **HTTPS 真源** 上复验）。
- [ ] **发行信任**：HTTPS 默认源 + 签名 manifest + artifact hash（编码已有，须在 prod URL 上签收）。

**签收标记**：路线图 **R3h-1** 由 **🟡 编码✅ / 发行⏳** 升为 **✅**（编码 + 发行）。

### Phase R2 — 产品串联（~1w，与 **R3h-2** 重叠）

| 项 | 内容 | 落位 |
|----|------|------|
| **一键准备** | 缺/坏 app_data 侧车且 manifest 可用 → 自动下载再 prepare | `useLocalRuntimeEnsureInstalled`、R3f 验收增补 |
| **UI 降噪** | bundled / 8741 已 OK 时弱化「manifest 未配置」为 informational | `LocalAsrRuntimeInstallPanel`、`buildRuntimeInstallPresentation` |
| **手动安装引导** | 「查看手动安装说明」展开「高级诊断」（已实现 `openEnvManualSetupGuide`） | 保持 |
| **弱网 / 续传** | Range、事件化进度、GC | **R3h-2**（勿与本轨混读为已完成） |

---

## 4. 战略选项（产品，非本轨阻塞）

| 策略 | manifest 角色 |
|------|----------------|
| **Fat 包 + manifest 作修复/OTA** | 过渡稳；与当前 bundled 策略一致 |
| **瘦包 + manifest 首次必需** | 安装包体积小；强依赖 Phase R1 默认 URL |
| **仅企业内网 manifest** | 自定义 HTTPS URL；适合内发 |

---

## 5. 验证命令

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml local_runtime
```

Phase R0 手测前：

```bash
bash scripts/prepare-local-runtime-fixtures.sh
# 按脚本输出 export RUSHI_LOCAL_RUNTIME_MANIFEST_URL / ALLOW_INSECURE
```

Phase R1 签收：干净 VM 手测 + CI smoke 日志归档至 release 证据目录。

---

## 6. 不做什么

- 不合并 **模型 manifest**（`RUSHI_MODEL_VERIFY_MANIFEST`）与 runtime manifest。
- 不在本轨实现 **R3h-2** 的 Range 续传 / **C 类自动健康回滚**。
- 不强制 dev 日常配置 manifest（bundled / `python -m rushi_asr` 仍为开发主路径）。

---

*文档版本：1.0 · 2026-06-07 · 自路线图对话「manifest 后期如何发挥作用」吸收为 R3h-1-R 发行激活轨。*
