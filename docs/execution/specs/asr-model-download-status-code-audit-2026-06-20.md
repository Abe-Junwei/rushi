# ASR 侧车模型下载 / 安装 / 状态读取与展示链路审查报告

> **审查日期**：2026-06-20  
> **审查范围**：`services/asr/rushi_asr/*`（Python 侧车）、`apps/desktop/src-tauri/src/asr_sidecar/*`（Rust 壳）、`apps/desktop/src/{pages,services}/asr*`（桌面 UI 状态机）  
> **基准提交**：`c45dfab` 之后的工作树（含未提交修改）  
> **既有文档**：本报告与 [`asr-model-download-status-architecture-research.md`](./asr-model-download-status-architecture-research.md)、[`asr-model-download-status-remediation-plan.md`](./asr-model-download-status-remediation-plan.md)、[`asr-model-download-status-remediation-acceptance.md`](./asr-model-download-status-remediation-acceptance.md) **互补**；若结论冲突，以本报告中代码行级对照为准。

---

## 1. 执行摘要

当前工作树正在实施 **P1 网络健壮性** 与部分 **P0 UX** 修复，已取得进展：

- Python 侧车新增 `force` 重启、`model_prepare_network.py` 重试、`socket` 超时收缩到 120s；
- Rust `watchdog_tick` 在 `prepare-status.phase=running` 时避免误报 `health_lost`；
- TS 侧新增 `prepareModelResume`、`asrPrepareActivityGate`、`loopbackFetchWithRetries`、health 降级保护。

但 **P0 核心 UX 缺陷仍未收口**：

1. `usePrepareModelController.prepareDefaultFunasrModel` 的 **health 预检在 `setPrepareModelBusy(true)` 之前**，点击下载后仍有几率先看到「已在缓存」再进入下载；
2. 一键准备 Wizard 的 `health` / `model` 步仍使用「就绪」终态文案，未按 D5/D4 区分；
3. `phase=idle` 超过 4s 后仍可能通过 `/health.ready_for_transcribe` 提前返回，存在 prepare 线程竞态。

建议：**先合并当前 P1 改动，再补一个独立的 Phase A PR 专门处理 busy 时序与文案。**

---

## 2. 审查方法

1. 按 **数据流** 而非文件流追踪：用户点击 → UI controller → HTTP → Python 下载线程 → 磁盘 cache → `/health` / `/prepare-status` → UI presentation。
2. 对照 **5 条成熟路线**：Ollama `/api/pull`、LM Studio Download Job、Hugging Face `huggingface_hub`、Kubernetes readiness/liveness、VS Code / Electron utilityProcess Supervisor。
3. 逐层检查 **R3-STATE**（`docs/architecture/desktop-capability-ui-state-alignment.md`）维度误用：D1 用户所选、D2 侧车运行、D4 按 SKU 缓存、D5 全局就绪、D7 下载中。
4. 使用 `git diff` 与工作树源码交叉验证，所有问题均给出 **文件 + 行号**。

---

## 3. 链路现状（三层）

### 3.1 Python 侧车层（`services/asr/rushi_asr/`）

```
app.py /v1/models/prepare/async
  → model_prepare.start_prepare_async(force=?)
    → model_prepare_state.try_begin_prepare_running()
    → 后台线程 model_prepare_download.download_models()
      → model_prepare_network.snapshot_download_with_retry()  (新增)
      → ModelScope snapshot_download
    → model_prepare_state.finish_prepare_done/error/cancelled
  ← GET /v1/models/prepare-status 读 model_prepare_state.prepare_status_body()
```

**关键状态真源**：`model_prepare_state.py` 模块级 `_state`（内存），phase ∈ `{idle, running, done, error, cancelled}`。

### 3.2 Rust 壳层（`apps/desktop/src-tauri/src/asr_sidecar/`）

- `probe.rs`：`probe_asr_port_and_health()` 单次 `/health`；`loopback_model_prepare_running()` 读 `/prepare-status.phase`。
- `supervisor.rs`：`watchdog_tick()` 在 `Ready` 态且 `/health` 不可达时，若 `loopback_model_prepare_running()` 为真则 **不降级为 `health_lost`**。

### 3.3 桌面 UI 层（`apps/desktop/src/`）

```
usePrepareModelController  （模型卡「下载当前模型」）
  → useAsrBridgeController.refreshAsrRuntimeInfo
    → useAsrHealthPoll.refreshAsrHealth
    → usePrepareModelController.prepareDefaultFunasrModel
      → POST /v1/models/prepare/async
      → 轮询 GET /v1/models/prepare-status
      → setAsrModelPrepareActive(true/false)
  ← buildAsrEnvPresentation + applyPrepareModelOverlay

useAsrSetupController / useAsrOneClickPrepare  （一键准备 Wizard）
  → runAsrOneClickPrepareFlow
    → diagnose → sidecar health → model flow
```

---

## 4. 对照成熟架构的差距

| 维度 | 本仓现状 | 成熟做法 | 差距等级 |
|------|----------|----------|----------|
| **就绪语义** | Wizard `health` 步文案「FunASR 运行时已就绪」；模型步先 `ok` 再下载 | K8s readiness：进程存活 ≠ 业务就绪；权重齐备才 ready | **P0** |
| **busy 时序** | 点击后先 `/health` 预检，再置 busy | LM Studio：Job 创建即 busy，UI 立即进入 downloading | **P0** |
| **Job 抽象** | `prepare-status` 只有 `phase/message/bytes` | LM Studio：`job_id` + `status` + `bytes_*` + `error_code` + 时间戳 | P1 |
| **续传协议** | 依赖 ModelScope 磁盘 cache + 外层 `force` 重启 | HF hub：文件级 `.incomplete` + ETag + 自动 resume | P1（不替换 ModelScope，可接受） |
| **单端点进度** | 轮询 1s GET | Ollama：NDJSON `/api/pull` 流式进度 | P2（计划不采纳） |
| **Supervisor 投影** | SupervisorSnapshot 无 prepare phase | Electron utilityProcess：父进程 FSM 是 UI 唯一真源 | P2 |

---

## 5. 问题清单（按优先级）

### P0 — 就绪语义混叠 / 用户可见假就绪

#### P0-1 `usePrepareModelController` busy 未前置到入口

**位置**：`apps/desktop/src/pages/usePrepareModelController.ts` L105–L145

**现象**：

```ts
const prepareDefaultFunasrModel = useCallback(async (options?) => {
  // ...abort controller...
  const hubModelId = getSelectedHubModelId();
  // L116-L129：先 /health 预检
  if (!options?.force) {
    const caps = await fetchAsrHealthCaps();
    if (caps?.ready_for_transcribe === true && caps.funasr_model_id === hubModelId && ...) {
      setPrepareModelProgress(100);
      setFunasrInstallMessage("...无需重复下载。");
      await refreshAsrRuntimeInfo();
      return;
    }
  }
  // L137：到这里才置 busy
  setPrepareModelBusy(true);
```

**问题**：

- 点击下载后、busy 置位前，如果 `/health` 显示 `ready_for_transcribe`（例如用户所选模型与侧车当前模型一致且已缓存），会 **立即显示「无需重复下载」**，跳过下载。这对 cache hit 是正确行为，但如果预检时 `ready_for_transcribe` 来自 **另一个 SKU 的全局就绪**（历史 SenseVoice 缓存），会误导用户。
- 更重要的是：在预检的异步窗口内，`buildAsrEnvPresentation` 仍用旧 caps，顶栏可能显示「已就绪」，而用户刚刚点击了下载。

**建议**：按 remediation plan §A1，将 `setPrepareModelBusy(true)` + `setAsrModelPrepareActive(true)` 移到函数第一行（abort 之后）。cache hit 的 fast path 在 return 前清 busy。

#### P0-2 一键准备 Wizard `health` 步文案终态化

**位置**：`apps/desktop/src/services/asr/asrOneClickPrepareSidecarHealth.ts` L85–L87

```ts
setSetupSteps((steps) =>
  patchStep(steps, "health", { status: "ok", detail: "FunASR 运行时已就绪" }),
);
```

**问题**：`funasr_ready` 只表示 ffmpeg + FunASR import 成功，**不含模型权重**。文案「已就绪」让用户误以为全部完成，随后进入 model 步又开始下载。

**建议**：改为「FunASR 运行时已加载（不含模型权重）」。

#### P0-3 一键准备 Wizard `model` 步提前 `ok`

**位置**：`apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts` L97–L102

```ts
setSetupSteps((steps) =>
  patchStep(steps, "model", {
    status: "ok",
    detail: `侧车已加载 ${modelSnap.modelLabel}`,
  }),
);
```

**问题**：`applyHubModelToSidecar` 成功后、`prepareDefaultFunasrModel` 下载前，就把 model 步标为 `ok`。用户看到「侧车已加载 XXX」，但权重可能还没下载。

**建议**：删掉这段提前 `ok`，让 model 步保持 `running` 直到 `prepare-status.phase=done`。

#### P0-4 `asrSetupState.stepsFromReport` sidecar 文案终态化

**位置**：`apps/desktop/src/pages/asrSetupState.ts` L39–L43

```ts
} else if (report.health.healthReachable) {
  steps = patchStep(steps, "sidecar", {
    status: "skipped",
    detail: report.bundledAvailable ? "侧车已就绪" : "服务已就绪",
  });
```

**问题**：诊断快照的 sidecar 步仍写「侧车已就绪」，与模型下载状态无关。

**建议**：改为「侧车进程已连接」或「侧车已在运行」。

#### P0-5 `phase=idle` 超过 4s 仍可能误判完成

**位置**：`apps/desktop/src/pages/usePrepareModelController.ts` L244–L267

```ts
} else if (phase === "idle") {
  if (Date.now() - runT0 < 4000) {
    bumpProgress("starting");
  } else {
    const caps = await fetchAsrHealthCaps();
    if (caps?.ready_for_transcribe === true && caps.funasr_model_id === hubModelId && ...) {
      setProgressIfChanged(100);
      setInstallMessageThrottled(".../health 已就绪");
      return;
    }
    // ...错误提示...
  }
}
```

**问题**：

- 4s 后读 `/health` 若 `ready_for_transcribe` 则提前 return，与 prepare 线程存在 **竞态**：线程可能尚未把 `phase` 从 `idle` 推到 `running`，但 `/health` 已经是旧缓存的 ready。
- 文案「侧车未返回下载进度，但 /health 已就绪」进一步强化了「先就绪再下载」的错觉。

**建议**：按 remediation plan §A5，idle 状态只在前 4s 显示「正在启动任务」，超过后应视为异常并提示重试，**不**再用 `/health` 跳过下载。

---

### P1 — Job 真源 / 网络健壮 / 续传

#### P1-1 `prepare-status` 缺少 Job 元数据

**位置**：`services/asr/rushi_asr/model_prepare_state.py` L25–L37

当前返回：

```json
{
  "phase": "running",
  "message": "downloading_recognizer",
  "error_code": null,
  "result": null,
  "progress_percent": 42,
  "bytes_downloaded": 123456789,
  "bytes_total": 290000000
}
```

**问题**：无 `job_id`、`updated_at_ms`、`stale`、`bytes_total_confidence`。UI 无法区分「旧任务仍在跑」与「新任务已启动」，也无法做 stall 检测。

**建议**：按 remediation plan §B1 做 **additive** 字段：

```json
{
  "job_id": "prepare-20260620-abc",
  "started_at_ms": 1718880000000,
  "updated_at_ms": 1718880060000,
  "stale": false,
  "bytes_total_confidence": "budget"
}
```

#### P1-2 进度 `bytes_total_confidence` 缺失

**位置**：`services/asr/rushi_asr/model_prepare_progress.py` L32–L34、L94–L96

**问题**：`_effective_total()` 永远取 `max(budget_total, declared_total, bytes_downloaded, 1)`，UI 不知道 total 是声明值还是预算估值，进度条可能在下载后期跳变。

**建议**：snapshot 增加 `bytes_total_confidence: "declared" | "budget" | "unknown"`。

#### P1-3 `snapshot_download_with_retry` 对非瞬态错误包装过粗

**位置**：`services/asr/rushi_asr/model_prepare_network.py` L54–L72

```python
except Exception as exc:
    last = exc
    if not is_transient_network_error(exc) or attempt >= max_attempts - 1:
        break
```

**问题**：`is_transient_network_error` 用字符串匹配（如 `"connection"`、`"timed out"`），可能把 **401/403 鉴权失败**、**404 模型不存在** 等误当瞬态错误重试。ModelScope 的 HTTP 错误通常包装为 `HTTPError`，其 message 可能含 `"Connection"` 等词。

**建议**：

- 显式识别 `HTTPError` 状态码：仅 408、429、5xx、ConnectionError、TimeoutError 视为瞬态；
- 4xx（除 408/429）立即失败并返回具体 `error_code`。

#### P1-4 `socket.setdefaulttimeout(120)` 是全局副作用

**位置**：`services/asr/rushi_asr/model_prepare_download.py` L184–L217

```python
old_timeout = socket.getdefaulttimeout()
socket.setdefaulttimeout(120)
try:
    ... snapshot_download ...
finally:
    socket.setdefaulttimeout(old_timeout)
```

**问题**：虽然 prepare 线程持有 `runtime_lock()`，但 `socket.getdefaulttimeout()` 是 **进程全局** 的。如果其他线程（如 transcribe job）同时创建 socket，会被影响。

**建议**：优先使用 `urllib3` / `requests` 级超时；如必须用 `socket.setdefaulttimeout`，应确保在 `runtime_lock` 内且无其他并发 socket 创建。更安全的做法是把超时传给 ModelScope 的 `snapshot_download`（若其支持）或自定义 transport。

#### P1-5 VPN 切换后 prepare 线程可能 orphan

**位置**：`services/asr/rushi_asr/model_prepare_download.py` L187–L216

**问题**：`snapshot_download` 是阻塞式 C 扩展调用，Python 的 `raise_if_prepare_cancelled()` 只在 ModelScope 回调触发时检查。VPN 切换导致底层 socket 挂死后，回调可能长时间不触发，`prepare-status.phase` 卡在 `running`。

**建议**：

- 在 `model_prepare_state.py` 增加 `updated_at_ms`，超过阈值（如 180s）无更新则 `stale=true`；
- UI 检测到 `stale` 后用 `force=true` 重启 prepare；
- 考虑为 `snapshot_download` 设置总超时（如 30min）或拆分为更小的可取消单元。

#### P1-6 `loopback_model_prepare_running()` 无法检测 stale

**位置**：`apps/desktop/src-tauri/src/asr_sidecar/probe.rs` L246–L251

```rust
pub fn loopback_model_prepare_running() -> bool {
    let Some(v) = loopback_get_json(LOOPBACK_PREPARE_STATUS_URL) else { return false };
    v.get("phase").and_then(|p| p.as_str()) == Some("running")
}
```

**问题**：只检查 `phase=running`，如果 prepare 线程 orphan，`watchdog_tick` 会无限期地跳过 health_lost 检测。

**建议**：等 Python 侧实现 `stale` 字段后，Rust 侧同步检查 `stale == false`。

---

### P2 — 架构与可维护性

#### P2-1 `model_prepare.py` 已近 176 行，且含 controller + 线程协调

**位置**：`services/asr/rushi_asr/model_prepare.py`

**问题**：6 月 12 日 code review 已建议拆分（R-12）。当前新增 `_wait_prepare_not_running`、`_release_prepare_before_restart` 后，controller 逻辑更重。

**建议**：拆出 `model_prepare_coord.py`（线程/force 协调）与 `model_prepare_api.py`（blocking API）。

#### P2-2 `asrPrepareActivityGate` 是全局可变状态

**位置**：`apps/desktop/src/services/asr/asrPrepareActivityGate.ts`

**问题**：模块级 `let modelPrepareActive = false`，无 React 上下文，多个 controller 实例可能互相覆盖。当前只有一个 `usePrepareModelController` 实例，所以风险低，但未来扩展时容易出错。

**建议**：中期改为 context/ref 传递；短期加注释说明「单例 controller」。

#### P2-3 模型缓存完整性仅依赖文件大小启发式

**位置**：`services/asr/rushi_asr/model_prepare_cache.py` L11–L15、L57–L76

```python
RECOGNIZER_MIN_WEIGHT_BYTES = 100 * 1024 * 1024
...
return weight_path.stat().st_size > min_weight_bytes
```

**问题**：仅检查 `model.pt` 大小 > 100MB，不校验 SHA256 或文件头。损坏/不完整下载若大小足够会被误判为已缓存。

**建议**：

- 保留现有 fast path；
- 对 release 包启用 `RUSHI_MODEL_VERIFY_MANIFEST` 的 manifest 校验（已有 `model_manifest_verify.py`）；
- 或在 `looks_like_complete_model_dir` 中加 `.incomplete` 文件排除逻辑。

#### P2-4 `funasr_engine` 单例与 prepare 共享 `runtime_lock`

**位置**：`services/asr/rushi_asr/funasr_engine_load.py` L28–L31

**问题**：`runtime_lock` 同时保护模型加载、prepare 下载、推理。prepare 下载大文件时会阻塞推理队列，转写按钮可能长时间不可用。

**建议**：这是已知设计（ADR-0001 独立进程 + 单 worker），但应在 `/health` 的 `inference_queue_stats` 中暴露排队情况，让 UI 能解释「模型下载中，转写不可用」。

---

## 6. 已修复 / 部分修复项

| 项 | 状态 | 证据 |
|----|------|------|
| 侧车 `force` 重启释放 stuck prepare | ✅ | `services/asr/rushi_asr/model_prepare.py` L42–L66、L109–L115 |
| `/prepare/async` 支持 `force` body | ✅ | `services/asr/rushi_asr/app.py` L49–L54、L185 |
| 网络瞬断重试 3 次 | ✅ | `services/asr/rushi_asr/model_prepare_network.py` |
| health poll 在 prepare 期间不降級 | ✅ | `apps/desktop/src/pages/useAsrHealthPoll.ts` L26–L40、L105–L110 |
| 一键准备 model 步在下载完成后才 `done` ok | 部分 ✅ | `asrOneClickPrepareModelFlow.ts` L163 移到 finalSnap 校验之后，但 L97–L102 提前 `ok` 仍在 |
| Wizard sidecar 文案区分 recoverable | 部分 ✅ | `asrSetupState.ts` L31–L38 修改了 `foreign` 分支，但 L42 仍写「侧车已就绪」 |
| `prepare-status` 增加 job 字段 | ❌ | 未实现 |
| `bytes_total_confidence` | ❌ | 未实现 |
| D7 overlay 锁 transcribeReady | ✅ | `apps/desktop/src/services/asr/asrEnvStatus.ts` L139–L174 |

---

## 7. 与 remediation plan 的对照

| Plan Phase | 当前工作树完成度 | 主要缺口 |
|------------|------------------|----------|
| **Phase A — P0 UX** | 约 30% | A1 busy 前置未做；A2 提前 model `ok` 未删；A3 文案未改；A5 idle 误判未去掉 |
| **Phase B — Job 契约 + 网络** | 约 60% | B1 job 字段未加；B2 `updated_at_ms` 未加；B3 `stale` 未加；B4 重试测试待补；B5/B6 待实现 |
| **Phase C — UI presentation 统一** | 0% | 未开始 |
| **Phase D — Supervisor 投影** | 0% | 依赖 R3h-I1 |

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| P0 文案/时序不修复就发布 | 用户反复看到「先就绪再下载」，投诉 | 优先 Phase A PR |
| `is_transient_network_error` 误判 4xx | 鉴权/模型不存在问题被重试，延迟反馈 | 补充 HTTPError 状态码判断 |
| `socket.setdefaulttimeout` 全局副作用 | 并发 transcribe 超时异常 | 改为局部 transport 超时或加锁 |
| `asrPrepareActivityGate` 全局状态被误用 | 多实例竞争 | 文档标注单例，中期改 context |

---

## 9. 建议下一步（按顺序）

1. **立即补 Phase A PR**（2–3h）：
   - `usePrepareModelController.ts`：busy + `setAsrModelPrepareActive(true)` 前置到入口；cache hit return 前清 busy。
   - `asrOneClickPrepareModelFlow.ts`：删除 L97–L102 的提前 model `ok`。
   - `asrOneClickPrepareSidecarHealth.ts` + `asrSetupState.ts`：文案改为「进程已连接」「运行时已加载（不含模型权重）」。
   - `usePrepareModelController.ts`：去掉 idle > 4s 读 `/health` 的 fast path。
   - 新增/更新 `asrSetupState.test.ts`、`usePrepareModelController` 行为测试。

2. **当前 P1 改动先合并**（已完成网络重试、force、watchdog 保护），但需补：
   - `test_model_prepare_network.py` 覆盖 4xx 不重试、5xx 重试；
   - `test_model_prepare.py` 覆盖 `force=true` 释放 stuck `running`。

3. **Phase B PR**（4–6h）：
   - Python：`prepare-status` additive job 字段、`updated_at_ms`、`stale`、`bytes_total_confidence`；
   - Rust：`loopback_model_prepare_running()` 同时检查 `stale`；
   - UI：`usePrepareModelController` 用 `updated_at_ms` 做 stall 检测与 auto-resume。

4. **Phase C/D** 按 remediation plan 排期。

---

## 10. 验证命令（每次 PR 必跑）

```bash
# 机器守卫
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs

# Python 侧车
cd services/asr && python3 -m pytest tests/test_model_prepare.py tests/test_model_prepare_network.py -q

# Rust 侧车（Phase B 若改 probe）
cargo test -p rushi-desktop asr_sidecar::probe -- --nocapture

# 手测
bash scripts/r3f-fresh-appdata-hand-test.sh
```

---

## 11. 结论

本链路在 **侧车进程健康 / 网络瞬断 / force 续传** 方面已有实质性加固，但 **用户可见的「就绪」语义仍未与「权重齐备」解耦**。当前工作树最紧迫的问题是：

- **busy 未前置** 导致点击下载瞬间可能闪现旧就绪状态；
- **Wizard 文案** 仍在用「就绪」描述仅进程/运行时健康的状态；
- **model 步提前 `ok`** 让用户误以为模型已下载完成。

建议不要把这些 P0 UX 修复留到 Phase B/C，而应在当前 P1 改动合并后 **立即开一个最小化的 Phase A PR**，专门处理时序与文案。这样可以用最小改动消除最明显的用户投诉点。
