# R3h-1-R 阶段签收（2026-06）

**状态** ✅ **R0 / R1 / R2 手测签收** — Release CI 自动发布 ⏳ 待补

> **Plan**：[`r3h-1-r-runtime-manifest-release-activation-plan.md`](./r3h-1-r-runtime-manifest-release-activation-plan.md)  
> **Checklist**：[`r3h-1-r-release-checklist.md`](./r3h-1-r-release-checklist.md)

## 交付摘要

| 项 | 落位 |
|----|------|
| 编译期默认 manifest URL | `local_runtime/catalog/config.rs` · `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL` |
| 发布脚本 | `scripts/publish-runtime-manifest.sh` · `npm run runtime:publish-manifest` |
| Release 公钥 | `local_runtime/catalog/signature.rs` · `rushi-runtime-release-v1` |
| UI 降噪（R2） | `localAsrSetupWizardPresentation.ts` · `LocalAsrRuntimeInstallPanel.tsx` |
| 一键准备 + manifest 下载 | `useLocalRuntimeEnsureInstalled.ts` |

## 发行真源（macOS arm64 · v0.1.0）

| 资产 | URL |
|------|-----|
| manifest | `https://github.com/Abe-Junwei/rushi/releases/download/runtime-v0.1.0/rushi-runtime-manifest.json` |
| sidecar zip | `https://github.com/Abe-Junwei/rushi/releases/download/runtime-v0.1.0/rushi-asr-sidecar-darwin-arm64.zip` |

DMG 构建时注入 `RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL`（见 checklist §3）。

## 手测签收

| 阶段 | 日期 | 平台 | 结果 |
|------|------|------|------|
| **R0** fixture | 2026-06-07 | macOS · 本地 fixture + env 覆盖 | ✅ |
| **R1** HTTPS 真源 | 2026-06-10 | macOS arm64 · 新 DMG · 无 `RUSHI_LOCAL_RUNTIME_MANIFEST_URL` | ✅ |
| **R2** 产品串联 | 2026-06-10 | macOS · fat 包 UI 降噪 + 瘦包模拟一键准备 | ✅ |

### R1 覆盖（checklist §4）

- 环境 → 本机 ASR → 「下载 / 修复」可用（非「manifest 未配置」）
- 下载完成 → `/health` OK → 可转写（零终端）
- 损坏可恢复：删 `funasr/version.txt` → 诊断 corrupt → 应用内重下修复

### R2 覆盖（plan §3 R2）

- bundled / 8741 已 OK 时侧车区 informational、默认折叠
- 无 bundled + 空 `local_runtime` → 一键准备自动 manifest 下载并完成准备

## 仍待（不阻塞本签收）

- [ ] Release CI：`publish-runtime-manifest` + 注入 default URL 的 `tauri build`（checklist §2–§3）
- [ ] **R3h-2**：Range 续传、下载进度 UI、GC、C 类升级回滚 — [`r3h-2-local-runtime-resume-acceptance.md`](./r3h-2-local-runtime-resume-acceptance.md)

## 复验命令

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml local_runtime
bash scripts/release-sidecar-preflight.sh
```
