# R3h-2 手测清单 — 断点续传与 C 类回滚

> **Acceptance**：[`r3h-2-local-runtime-resume-acceptance.md`](./r3h-2-local-runtime-resume-acceptance.md)  
> **平台**：macOS arm64（与 R3h-1-R 发行真源一致）

## 前置

- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [ ] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml local_runtime`
- [ ] 桌面应用可启动；`local_runtime` 目录可写（或已清空侧车以测完整下载）

## 场景 1 — 断点续传

| 步 | 操作 | 期望 |
|----|------|------|
| 1 | 删除 `~/Library/Application Support/.../local_runtime/`（保留 models 可选） | 诊断：侧车未安装 |
| 2 | 环境 → 本机 ASR → 「下载 / 修复」 | 出现进度条；百分比 / MB 上升 |
| 3 | 下载约 20–40% 时点「取消下载」 | 文案提示断点续传；`.part` 留在 `downloads/` |
| 4 | 再次点「下载 / 修复」 | 文案含「断点」或进度非 0% 起跳；最终 health OK |

## 场景 2 — C 类自动回滚

C 类触发条件：**current 已切到新版本** 且 revalidate/verify 失败 → 自动 `restore_previous`（见 `recovery/auto_rollback.rs`）。

| 步 | 操作 | 期望 |
|----|------|------|
| 1 | `current=0.2.0`，`previous=0.1.0`；0.2.0 健康劣化 | marker 双槽就绪 |
| 2 | 触发 revalidate（或升级后首次健康检查失败） | verify 失败且非瞬态 |
| 3 | 观察结果 | 自动回退 `0.1.0`；UI「已自动恢复上一版本」 |

### 产品 UI 手测（仍阻塞）

稳定 manifest 仅 **`0.1.0`**，无法在应用内走完整「下载 0.2.0 → 切换 → 自动回滚」UI 链。

### Dev 集成测（已替代核心链路）

```bash
bash scripts/test-r3h-2-c-rollback.sh
```

- 用 fake sidecar 模拟 `0.2.0` `/health` 500 + `0.1.0` 健康 OK
- `run_revalidate` → `AutoRolledBack("0.1.0")`（~2s，2026-06-10 ✅）

**说明**：安装阶段 staging verify 失败属 **A 类**（保留旧 current，不切换 marker）；C 类覆盖 **切换后** 劣化。fixture `rushi-runtime-manifest-v0.2.0-corrupt-upgrade.json` 可在发 `0.2.0` 后补 UI 手测。

## 签收

| 项 | 日期 | 结果 |
|----|------|------|
| 场景 1 断点续传 | 2026-06-10 | ✅ 产品手测通过 |
| 场景 2 C 类回滚 | 2026-06-10 | ✅ **dev 集成测**（`test-r3h-2-c-rollback.sh`）；⏸ 完整 UI 链待 manifest `0.2.0` |
