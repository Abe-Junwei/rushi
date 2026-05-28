# ASR Setup 幂等与多真源专项审计（2026-05-27）

> **范围**：已就绪 / warm 侧车场景下的重复操作、UI 与 pref/diagnose 分叉、破坏性 restart。  
> **非范围**：FunASR 推理逻辑、R3t-A 分段、转写 pipeline（见 `asr-sidecar-runtime-audit-2026-05-27.md`）。

---

## 1. 问题类别（审查透镜）

| ID | 类别 | 典型症状 |
|----|------|----------|
| C1 | **重复入口未幂等** | 已可转写再点「一键准备」报错或杀侧车 |
| C2 | **多真源不一致** | 环境页显示就绪，向导/apply 用 pref 或 diagnose 判 false |
| C3 | **warm 路径误 restart** | `setLocalAsrHubModelPref` / `retryBundled` 在 `/health` 已 ready 时仍执行 |
| C4 | **诊断刷新污染 UI** | `refreshSetupDiagnose` 把 outcome/message 打回 idle |
| C5 | **双轨 HTTP 误判** | loopback 通、Tauri diagnose 不通 → 误走启动/重启分支 |

---

## 2. 真源矩阵（审计后约定）

| 用途 | 真源 | 禁止 |
|------|------|------|
| 环境页「可转写」 | `computeLocalAsrTranscribeReady` + **UI `selectedHubModelId`** + loopback caps | 单独用 `ready_for_transcribe` 忽略所选 SKU |
| 一键准备 / 外部队车接受 | 同上 + `snapshotSelectedModelPrepare(ctx)` | `resolvePreferredLocalAsrHubModelId()` 单独作 UI 真源 |
| 持久化下次 spawn | Tauri `prefs/funasr_hub_model_id.txt` | pref 覆盖 UI 展示而不写回 |
| 向导摘要 / blocking 文案 | `asr_setup_diagnose`（Rust reqwest） | 作 loopback 可达性唯一依据 |
| 是否杀侧车 | loopback `/health`：`funasr_ready` + `funasr_model_id` + `ready_for_transcribe` | diagnose 的 `healthReachable` 单独触发 restart |

**UI 所选模型写入 pref**：仅在「应用模型」或 warm 同步（`restartSidecar: false`）时写盘，不隐式以 pref 覆盖下拉框（`bootstrapFromTauri` 仅在启动时对齐一次）。

---

## 3. 入口走读清单

| 入口 | 文件 | C1–C5 审计 | 本轮处置 |
|------|------|------------|----------|
| 一键准备 | `useAsrOneClickPrepare.ts` | C1 C2 C3 C5 | **已修**（loopback 短路 + UI ctx + warm skip sidecar） |
| 接受外部队车 | `useAsrSetupHealthFlow.ts` | C1 C2 C4 | **已修**（ready 短路 + loopback 终判 + touchUi） |
| 应用所选模型 | `useLocalAsrModelCatalog.ts` | C1 C3 | **已修**（`applyHubModelToSidecar` + 90s poll） |
| 模型切换 / 重试侧车 Rust | `bundled.rs` `force_restart` | C3 | **已修**（`SKIP_BUNDLED` 时不再 kill 8741） |
| 一键准备模型不一致 | `useAsrOneClickPrepare.ts` | C1 C2 | **已修**（自动切换模型，不再只提示去转写页） |
| 校验/刷新缓存 | `usePrepareModelController.ts` | C1 | **已修**（非 force 且已 ready 则 noop） |
| 重试内置侧车按钮 | `useAsrBridgeController.ts` | — | **保留**（显式破坏性操作，用户意图明确） |
| 刷新环境诊断 | `refreshLocalAsrDiagnostics.ts` | C4 | **已修**（`touchUi: false`） |
| 向导挂载自动诊断 | `LocalAsrSetupWizard.tsx` | C4 | **已修**（`touchUi: false`） |
| 向导「重新诊断」按钮 | 同上 | — | 保持 `touchUi: true`（用户显式请求） |
| `set_local_asr_hub_model_pref` | `local_asr_model.rs` | C3 | **已修**（pref 未变 / `restartSidecar: false` 不 restart） |
| `syncBundledSidecarToPreferredHub` | `localAsrSetupModelStep.ts` | C3 | **已修** |
| `resolvePreferredLocalAsrHubModelId` | `localAsrModelCatalog.ts` | C2 | **弃用作 UI 真源**（仅文档保留，无调用方） |

---

## 4. 验收矩阵（专项手测 + 自动化）

| # | 场景 | 操作 | 期望 |
|---|------|------|------|
| I1 | 已可转写 | 再点「一键准备本机 ASR」 | 成功文案含「无需重复准备」；8741 不断连 |
| I2 | 已可转写 | 点「校验/刷新缓存」（非 force 语义下已 ready） | 快速完成，不 POST prepare |
| I3 | 侧车已加载所选 SKU | 点「应用所选模型」（未换 SKU） | 提示已运行，**不** double restart |
| I4 | pref 陈旧、侧车与 UI 一致 | 一键准备 | 写 pref（no restart），不杀侧车 |
| I5 | 外部队车已 ready | 「使用当前 8741 服务」 | 不重复 prepare；loopback 终判通过 |
| I6 | 环境页刷新 | 刷新 ASR 状态 | 向导 outcome 不被打回 idle |
| I7 | 自动化 | `npm run test -w @rushi/desktop` | 含 idempotency 用例绿 |

---

## 5. 自动化覆盖

| 测试文件 | 覆盖 |
|----------|------|
| `useAsrSetupController.test.ts` | I1 I4 短路、retry 仅在 cold |
| `localAsrSetupModelStep.test.ts` | sync warm / stale pref |
| `localAsrIdempotency.test.ts` | `shouldSkipSidecarRestartForSelection` 纯函数 |
| `useLocalAsrModelCatalog.test.ts` | apply warm skip（mock） |

---

## 6. 维护纪律（防回归）

1. 新增 ASR setup 入口 **必须先** 填 §3 表一行，并声明 C1–C5 结论。  
2. 任何 `force_restart_bundled` / `retryBundledAsrSidecar` 调用 **必须** 注释用户意图或经 `shouldSkipSidecarRestartForSelection` 守卫。  
3. 后台 `refreshSetupDiagnose` **默认** `{ resetSteps: false, touchUi: false }`；仅用户点击「重新诊断」用 `touchUi: true`。  
4. PR 改 `computeLocalAsrTranscribeReady` 或 hub 解析时 **必须** 跑 §4 I1–I3 手测或补单测。

---

## 7. 与上轮全量审计关系

`asr-sidecar-runtime-audit-2026-05-27.md` 覆盖 **连通性 / env / loopback**；本 spec 覆盖 **setup 状态机幂等**。两文档互补，提交前至少跑两 spec 的自动化签收。
