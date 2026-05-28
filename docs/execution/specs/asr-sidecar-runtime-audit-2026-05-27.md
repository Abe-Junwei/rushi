# ASR 侧车模型 Runtime 全量审计（2026-05-27）

> **状态**：全量走读完成 + P0/P1/P2 已落地（见 §8）。  
> **签收**：`npm run typecheck` · `npm run test -w @rushi/desktop` · `npm run asr:test` · `node scripts/check-architecture-guard.mjs`

---

## 1. 执行摘要

| 类别 | 数量 | 说明 |
|------|------|------|
| **P0 已修** | 4 | 模型路径/env 分叉、8741 旧进程、手动启动无 env、手测文档误导 |
| **P1 已修** | 9 | 路径 helper 统一、verify 缺 hub、SKIP_BUNDLED 杀外部队车、UI/测试/文档 |
| **P2 已修/部分** | 4 | E2E 字段、pytest 隔离、prepare glob 移除 |
| **已知遗留** | 5 | 见 §7（非阻塞，有缓解） |

---

## 2. 路径与环境变量真源

```
Tauri app_data_dir()  →  resolve_app_data_root()  →  <root>/models
                              ↓
        RUSHI_MODELS_ROOT + MODELSCOPE_CACHE + HF_HOME (+ RUSHI_FUNASR_MODEL)
                              ↓
                    rushi_asr/model_cache_env.apply_models_root_env()
```

| 真源文件 | 消费者 |
|----------|--------|
| `project/app_data_paths.rs` | `setup_db`, `bundled.rs`, `asr_cache_cmd`, `diagnose`, `verify`, `installer`, `recovery` |
| `scripts/resolve-asr-models-root.sh` | `desktop-dev.sh`, `run-asr-dev.sh` |
| `model_cache_env.py` | 所有 `/health`、prepare、engine |

---

## 3. HTTP 客户端矩阵（审计后）

| 场景 | 实现 | Host | 超时 |
|------|------|------|------|
| 环境页 health/catalog/prepare | `loopbackFetch` → `asr_loopback_request` | **127.0.0.1** | 8s–900s |
| 向导 diagnose | `asr_setup_diagnose` reqwest | 127.0.0.1:8741 | 8s |
| 转写 | `post_transcribe_multipart` reqwest | `asrBaseUrl()` | 动态 |
| 浏览器预览 | `loopbackFetch` → raw `fetch` | 用户 URL | PNA 风险 |

**结论**：生产 Tauri 路径已统一 loopback + IPv4；禁止依赖 WebView 直连 8741。

---

## 4. 全量文件清单（走读状态）

### 4.1 Python — `services/asr/`

| 文件 | 状态 | 备注 |
|------|------|------|
| `rushi_asr/__main__.py` | OK | `bind_addr` loopback-only |
| `rushi_asr/app.py` | OK | CORS + PNA middleware；prepare/transcribe 线程池 |
| `rushi_asr/model_cache_env.py` | OK | `RUSHI_MODELS_ROOT` → caches |
| `rushi_asr/runtime_caps.py` | OK | `funasr_default_model_cached` = 默认 SKU；`active_*` 跟当前模型 |
| `rushi_asr/model_prepare.py` | **FIX** | 移除 `**/{name}` 全树 glob；`reset_prepare_idle_state` |
| `rushi_asr/model_catalog.py` | OK | 与 prepare 缓存猜测一致 |
| `rushi_asr/defaults.py` | OK | hub / VAD / punc 默认 |
| `rushi_asr/funasr_pipeline.py` | OK | punc 派生 |
| `rushi_asr/funasr_engine.py` | OK | `required_models_cached` 门禁 |
| `rushi_asr/engine.py` | OK | 上传转写入口 |
| `rushi_asr/model_prepare_progress.py` | OK | 取消事件 |
| `rushi_asr/model_manifest_verify.py` | OK | manifest 校验 |
| `rushi_asr/segmentation.py` | OK | R3t-A（非 runtime 路径，不审逻辑） |
| `tests/test_health.py` | **FIX** | `rushi_models_root` 反射 env |
| `tests/test_model_prepare.py` | **FIX** | autouse 隔离 prepare 状态 |
| `tests/test_model_catalog.py` | OK | |
| `tests/test_bind.py` | OK | loopback bind |
| `tests/test_funasr_engine.py` | OK | |

### 4.2 Rust — `apps/desktop/src-tauri/src/`

| 文件 | 状态 | 备注 |
|------|------|------|
| `asr_sidecar/mod.rs` | OK | `ASR_HEALTH_URL` |
| `asr_sidecar/bundled.rs` | **FIX** | `apply_asr_model_env`；`ASR_LOOPBACK_PORT` |
| `asr_sidecar/loopback.rs` | OK | 固定 127.0.0.1；`timeout_ms` |
| `asr_sidecar/probe.rs` | DOC | 2s 探测；冷启动误判风险见 §7 |
| `asr_sidecar/candidates.rs` | OK | |
| `project/app_data_paths.rs` | **NEW** | 路径 + `apply_asr_model_env` |
| `project/asr_runtime_paths_cmd.rs` | OK | `get_asr_runtime_paths` + 单测 |
| `project/asr_cache_cmd.rs` | **FIX** | 使用 path helpers |
| `local_asr_model.rs` | **FIX** | `read_hub_model_pref_for_app_root`；SKIP_BUNDLED 不 force_restart |
| `asr_setup/diagnose.rs` | **FIX** | models_root helper；8s 超时 |
| `local_runtime/install_support/verify.rs` | **FIX** | 与 spawn 同 env |
| `local_runtime/installer.rs` | **FIX** | models_root helper |
| `local_runtime/recovery.rs` | **FIX** | models_root helper |
| `project/run_transcribe_cmd.rs` | OK | 默认 127.0.0.1:8741 |
| `project/transcribe*.rs` | DOC | ffprobe 用 PATH 非 bundled，见 §7 |

### 4.3 前端 — `apps/desktop/src/`

| 文件 | 状态 | 备注 |
|------|------|------|
| `config/env.ts` | OK | 默认 127.0.0.1:8741 |
| `services/asr/loopbackFetch.ts` | OK | 唯一 Tauri→8741 路径 |
| `services/asr/asrHealthSnapshot.ts` | OK | |
| `services/asr/localAsrModelCatalog.ts` | OK | R3-STATE `transcribeReady` |
| `services/asr/asrRuntimePathsAlign.ts` | OK | 路径比较 |
| `pages/useAsrBridgeController.ts` | OK | health + 手册命令 |
| `pages/usePrepareModelController.ts` | OK | 全 loopback |
| `pages/useLocalAsrModelCatalog.ts` | **FIX** | apply + retry / asr:dev 文案 |
| `pages/useAsrSetup*.ts` | OK | diagnose 与 health 双轨已知 |
| `pages/refreshLocalAsrDiagnostics.ts` | OK | |
| `pages/prepareModel*.ts` | **FIX** | fetch_failed 文案 |
| `components/EnvLocalAsrPanel.tsx` | **FIX** | 连接/缓存/ready 分栏 |
| `components/envLocalAsr/*` | OK | |
| `tauri/projectApi.ts` | OK | `getAsrRuntimePaths` |
| `tests/e2e/asr-health.spec.ts` | **FIX** | 断言 `rushi_models_root` 字段存在 |

### 4.4 脚本

| 文件 | 状态 | 备注 |
|------|------|------|
| `scripts/resolve-asr-models-root.sh` | OK | macOS + Linux + Git Bash Windows |
| `scripts/desktop-dev.sh` | **FIX** | 错配自动重启 8741 |
| `scripts/run-asr-dev.sh` | **NEW** | `npm run asr:dev` |
| `scripts/bootstrap-asr-venv.sh` | **FIX** | 指向 asr:dev |
| `scripts/smoke-asr-sidecar-health.sh` | DOC | 不测 models_root（bundle smoke） |
| `scripts/p0-acceptance.sh` | DOC | 正交；注释已有 |
| `scripts/install-funasr-for-desktop.sh` | DOC | 待下轮补 asr:dev 提示 |

### 4.5 文档

| 文件 | 状态 |
|------|------|
| `docs/architecture/asr-sidecar-funasr-policy.md` §11 | **FIX** |
| `services/asr/README.md` | **FIX** |
| `docs/execution/specs/r3t-a-hand-test-checklist.md` | **FIX** |
| `docs/execution/specs/r3f-asr-setup-wizard-acceptance.md` | DOC | 可补 D5/D6 手测项 |
| `docs/execution/reviews/chains/asr-sidecar-transcribe.md` | DOC | 可补 loopback 分支 |

---

## 5. 已修复问题登记

| ID | 问题 | 修复 |
|----|------|------|
| P0-1 | 手动/旧 dev 侧车无 `RUSHI_MODELS_ROOT` | `asr:dev` + `desktop-dev` + README |
| P0-2 | 8741 旧进程 env 陈旧 | `desktop-dev` kill+restart |
| P0-3 | WebView fetch / localhost→::1 | `loopback` 固定 127.0.0.1 |
| P1-1 | verify 无 `RUSHI_FUNASR_MODEL` | `apply_asr_model_env` + hub pref |
| P1-2 | 路径 `join("models")` 分散 | `app_data_paths` 全局 |
| P1-3 | apply 模型不重启 / 误杀外部队车 | retry_bundled + SKIP 守卫 |
| P1-4 | UI 混淆连接与未缓存 | `EnvLocalAsrPanel` 分块 |
| P2-1 | prepare 测试并行污染 | autouse fixture |
| P2-2 | `/health` glob 扫描 | 移除 `**/{name}` |
| P2-3 | E2E 未测 `rushi_models_root` | 补断言 |

---

## 6. 验收矩阵

| # | 场景 | 命令 | 期望 |
|---|------|------|------|
| T1 | dev 冷启动 | `npm run desktop:dev` | `rushi_models_root` = 桌面 models |
| T2 | 仅侧车 | `npm run asr:dev` | 同上 |
| T3 | health | `curl 127.0.0.1:8741/health` | `rushi_models_root` 非 null |
| T4 | 环境页 | 刷新状态 | 无「未绑定」黄条（侧车正确时） |
| T5 | 自动化 | §1 四门 | 绿 |

---

## 7. 已知遗留（未在本轮改）

1. **`probe.rs` 2s GET `/`**：FunASR 冷导入时可能误判旧侧车并 kill（`bundled.rs` wait 路径）— 手测时用 `desktop-dev` 已起好的进程可规避。  
2. **`transcribe_timeout` 用 PATH ffprobe**：未用 bundled `_internal/ffprobe` — 无 host ffprobe 时长音频超时偏短。  
3. **`funasr_default_model_cached`**：语义为默认 SKU（SenseVoice），非当前 active 模型 — UI 已用 `active_*` + catalog。  
4. **E2E 无 webServer**：仍依赖外部 8741 进程 — CI 需预起侧车。  
5. **`install-funasr-for-desktop.sh`**：未自动打印 `asr:dev` — 低优先级文档。

---

## 8. 本轮变更文件（实现清单）

- `project/app_data_paths.rs`（新）
- `project/asr_runtime_paths_cmd.rs`
- `asr_sidecar/bundled.rs`, `loopback.rs`
- `local_asr_model.rs`, `verify.rs`, `diagnose.rs`, `asr_cache_cmd.rs`, `installer.rs`, `recovery.rs`
- `scripts/resolve-asr-models-root.sh`, `desktop-dev.sh`, `run-asr-dev.sh`, `bootstrap-asr-venv.sh`
- `package.json` → `asr:dev`
- 前端：`loopbackFetch`, `EnvLocalAsrPanel`, `useLocalAsrModelCatalog`, `prepareModelDownloadCopy`, tests
- Python：`model_prepare.py`, `test_health.py`, `test_model_prepare.py`
- 文档：本文件、`README.md`、`asr-sidecar-funasr-policy.md` §11、`r3t-a-hand-test-checklist.md`

---

## 9. 维护纪律

1. 新增「启动侧车」代码路径 **必须** 调用 `apply_asr_model_env`（Rust）或 `export_asr_model_env`（shell）。  
2. 禁止在 WebView 对 8741 新增 raw `fetch`（用 `loopbackFetch`）。  
3. 改 `resolve_app_data_root` 规则时 **同步** `resolve-asr-models-root.sh`。  
4. `/health` 新字段须同步 `projectApi.AsrHealthCapabilities` + `parseAsrHealthJson`。  
5. **Setup 幂等 / 多真源** 见专项审计 [`asr-setup-idempotency-audit-2026-05-27.md`](./asr-setup-idempotency-audit-2026-05-27.md)。
