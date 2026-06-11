# Acceptance: R3h-2 — 侧车断点续传、GC 与 C 类自动回滚

> **状态**：✅ **编码✅ / 验收✅**（断点续传产品手测 ✅；C 类 dev 集成测 ✅ — [`checklist`](./r3h-2-hand-test-checklist.md)）  
> **Research / 实施真源**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) §2、§3.7、§5 Phase 2、§11  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.2 ⑦、§4.1.5.1 C 类回滚  
> **依赖**：**R3h-1-R** ✅

## 目标

大体积侧车 zip（~2GB）在弱网、中断、升级验证失败时仍可恢复；用户可见 **阶段 + 字节进度**；旧版目录自动 GC；升级后健康劣化时 **自动回退 previous**（C 类）。

## 范围

### 做

| # | 交付 | 落位 |
|---|------|------|
| 1 | HTTP **Range** 续传 + `.part` / `.meta.json` 检查点 | `install_support/download.rs`、`download_resume.rs` |
| 2 | 取消下载保留 part；下次从断点续传 | `installer/commands.rs` |
| 3 | 安装成功后 **GC** 非 current/previous 版本目录 | `integrity/gc.rs`、`installer/run.rs` |
| 4 | 验证失败（非瞬态）→ **C 类自动回滚** previous | `recovery/auto_rollback.rs`、`installer/commands.rs` |
| 5 | `LocalRuntimeInstallProgress`：`phase` + `downloaded_bytes` + `total_bytes` | `installer/types.rs`、`localRuntimeContract.ts` |
| 6 | 环境页侧车区：**下载进度条** + 阶段文案（与模型 prepare 同视觉层级） | `localAsrSetupWizardPresentation.ts`、`LocalAsrRuntimeInstallPanel.tsx` |
| 7 | 安装进行中 **轮询 diagnose**（≤500ms）刷新进度 | `useLocalRuntimeDiagnoseState.ts` |
| 8 | focused tests：resume meta、GC、auto-rollback 条件 | `download_resume.rs`、`gc.rs`、`auto_rollback.rs` tests |

### 不做

- Tauri **事件推送**替代 diagnose 轮询（v1 轮询即可；R3h-I2 可再收口）
- 模型 prepare 与侧车下载 **统一事件总线**（仅对齐契约字段；Q-R3g-3 真取消已在 prepare 轨）
- mirror fallback / 企业代理专项（弱网手测记录即可，不新开协议）
- **R3d** 五栏 IA、**R3h-3** 三盏灯

## 能力—UI 状态矩阵

| UI 控件 / 文案 | 状态维度 | 数据源 | 手测场景 |
|----------------|----------|--------|----------|
| 侧车「下载 / 修复」 | 安装 FSM `idle/downloading/…` | `diag.install.phase` | manifest 阻断时不得显示可点下载（除非已在安装中） |
| 下载进度条 | 字节 D4 | `install.downloadedBytes` / `totalBytes` | 下载中百分比随轮询上升；取消后保留 part |
| 取消下载 | 可取消 + 可恢复 | `local_runtime_cancel_download` | 取消后文案提示断点续传；重试从 part 继续 |
| 升级失败 | current 保留 + C 回滚 | `installed.status` + `install.phase=error` | corrupt 新版本验证失败 → 自动 previous 或保留 current |
| 恢复上一版本 | B 类手动 | `installed.previousVersion` | 与 C 类文案不矛盾 |

## 验收标准

- [x] Range 续传：`.part` + meta 与 manifest `sha256`/`version` 绑定（Rust tests）
- [x] GC：删除非 current/previous 版本目录（Rust tests）
- [x] C 类：`local_runtime_verify_*` 失败且存在 previous → 自动 `restore_previous`（Rust tests）
- [x] UI：下载中显示进度条与 `MB/MB` 或 `%` 标签（`LocalAsrRuntimeInstallPanel` + `computeRuntimeDownloadProgress`）
- [x] 弱网手测：下载至 ~30% 取消 → 重试续传（part 增大，非从零）— checklist 场景 1 ✅ 2026-06-10
- [x] C 类回滚：current 劣化 → revalidate 自动恢复 previous — `bash scripts/test-r3h-2-c-rollback.sh` ✅ 2026-06-10
- [ ] （可选）完整 UI 升级链：manifest `0.2.0` 发布后补测「下载损坏新版 → 自动回滚」文案
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（2026-06-10 · 1166 tests）
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml local_runtime`（39 passed）

## 手测场景（2 组）

1. **断点续传**：清空 `local_runtime` → 开始下载 → 约 30% 点「取消」→ 再点「下载 / 修复」→ 文案含「断点」或进度非 0% 起跳  
2. **C 类回滚**：已装 0.1.0 → 触发升级至损坏 0.2.0 → 验证失败 → 自动恢复 0.1.0 或明确「升级未生效，仍保留 0.1.0」

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-10 | 初版：R3h-1-R 签收后进入 R3h-2；Rust 核心引用 commit `2de6b20` |
| 2026-06-10 | UI 进度条 + 500ms 轮询；自动化闸门全绿；手测清单 |
| 2026-06-10 | 手测：场景 1 断点续传 ✅；场景 2 C 类 dev 集成测 ✅（`recovery/run_tests.rs` + `test-r3h-2-c-rollback.sh`） |
