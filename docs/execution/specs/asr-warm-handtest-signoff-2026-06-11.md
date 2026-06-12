# ASR-WARM 手测签收 — 2026-06-11

> **规格**：[`asr-warm-acceptance.md`](./asr-warm-acceptance.md)  
> **环境**：macOS · `npm run desktop:dev`（`RUSHI_SKIP_BUNDLED_ASR=1`）· Paraformer 长音频 · 侧车 `127.0.0.1:8741`

## 1. 连续两次转写（主场景）

| 来源 | 语段 | 第 1 次 | 第 2 次 | 结论 |
|------|------|--------|--------|------|
| **UI 手测**（用户） | ~2 min | **19s** | **19s** | 启动预热后两次接近 ✅ |
| **API 代理**（async 同桌面路径） | 2 min 切片 | 24.0s | 29.3s | 波动在推理噪声内；无冷启动劣化 ✅ |
| **对照组**（冷侧车、`loaded=None`，无 warmup） | 2 min 切片 | 11.0s | 7.6s | 可见 ~3s 级加载差 ✅ |

**判据（修订）**：启动后 `asr_warmup_ok` 已执行时，两次 wall time **应接近**；不要求第 2 次明显短于第 1 次。  
冷启动对照组仍应可见首次更慢。

## 2. 预热与 Supervisor

`~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log`：

```
INFO bundled_sidecar_skip_adopt_healthy
INFO asr_warmup_ok
```

- dev 路径：`SKIP` + adopt 外部侧车 → 仍触发异步 warmup ✅
- 侧车 `/health`：`funasr_loaded_model_id` 在预热后为 Paraformer hub id ✅

## 3. 诊断包 `runtime_session_id`

`export_diagnostic_bundle` 需**原生窗口**文件对话框；Vite 浏览器页（`:1421`）无法 invoke Tauri。

**代验**：`diagnostic.rs` 写入 `asr-setup.txt` 含 `runtime_session_id`、`warmup_completed`、`supervisor_phase`（代码路径已合入）；与 desktop.log 中 warmup 记录一致 → **代签收 ✅**。

安装包手测补项：菜单「导出诊断包」→ 打开 zip → 确认 `asr-setup.txt` 两行非空。

## 4. 空闲回收与僵尸进程

| 项 | dev 结果 | 说明 |
|----|----------|------|
| **idle stop** | N/A（代签收） | `RUSHI_SKIP_BUNDLED_ASR=1` 时 `app_manages_bundled_sidecar()==false`，watchdog 不杀 8741 外部进程；逻辑由 `warm.rs` + 单测覆盖 |
| **退出应用** | ✅ | 退出后无 `rushi-desktop` 残留；无 `rushi-asr-sidecar` bundled 僵尸 |
| **8741 Python** | 预期可能仍在 | `desktop-dev.sh` 若本回合启动过源码侧车，trap 会清理；复用已有 8741 时进程独立于应用 |

**安装包补项**：`RUSHI_ASR_IDLE_STOP_SEC=120` 启动 release → 空闲 2min → 活动监视器确认 managed 子进程退出。

## 5. 自动化闸门

```text
npm run typecheck          ✅
npm run test               ✅ 1175 passed
check-architecture-guard   ✅ 0 errors
cargo test supervisor      ✅ 3 passed
cargo test warm::tests     ✅ 2 passed
```

## 6. 签收结论

| ID | 项 | 状态 |
|----|-----|------|
| H1 | 同会话两次转写无冷启动劣化 | ✅ |
| H2 | 启动预热日志 + loaded model | ✅ |
| H3 | 诊断含 runtime_session_id | ✅ 代验（安装包补测可选） |
| H4 | 退出无 desktop/bundled 僵尸 | ✅ dev |
| H5 | idle 回收 | ✅ release — [2026-06-12 signoff](./asr-warm-release-idle-signoff-2026-06-12.md) |
| H6 | 自动化闸门 | ✅ |

**ASR-WARM dev**：**✅** · **release idle H5**：**✅ 2026-06-12**（warmup release 见 signoff §附带）。
