# Plan: ASR 侧车下载 / 安装 / 状态展示 — 可靠健壮收口

> **Research**：[asr-model-download-status-architecture-research.md](./asr-model-download-status-architecture-research.md)  
> **Acceptance**：[asr-model-download-status-remediation-acceptance.md](./asr-model-download-status-remediation-acceptance.md)  
> **状态**：规划定稿（2026-06-20）— **待用户确认后编码**  
> **关联**：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) · [`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) §1.4 · [`r3h-i1-runtime-supervisor-fsm-plan.md`](./r3h-i1-runtime-supervisor-fsm-plan.md)

---

## 1. 目标

把本机 ASR **资产准备**（LRC 侧车包 + FunASR 权重）收成 **可靠、可解释、可续传** 的状态机，消除：

1. **假就绪**：下载开始前出现「侧车已就绪 / 可转写」类终态文案  
2. **假失败**：VPN/忙时 `/health` 瞬断导致顶栏误报、进度清零  
3. **假卡住**：prepare 线程 orphan、`phase=running` 无法 force 续传  
4. **三源分裂**：Rust diagnose / `/health` / `/prepare-status` 各说各话

**不替换** ModelScope 下载器；**不**在 v1.1 做 NDJSON pull 大改。

---

## 2. 成功定义（可手测 + 可自动化）

| ID | 标准 |
|----|------|
| **S1** | 从「一键准备」或「下载当前模型」开始，至 prepare `done`，**全程**顶栏/chip/wizard 不出现「可转写」「侧车已就绪（终态）」 |
| **S2** | 下载中切换 VPN 一次：自动续传或明确可重试；**进度条不无故归零**；最终 `done` 或可读 `error_code` |
| **S3** | `prepare-status.phase=running` 时 Rust watchdog **不** `health_lost` 杀侧车 |
| **S4** | 同一 SKU 已缓存时点下载：**≤3s** 内完成（cache hit），文案为「已在缓存」而非假下载 |
| **S5** | 诊断包 / setup 步骤能区分：**进程存活**、**运行时健康**、**权重齐备**、**下载进行中** 四态 |

---

## 3. 状态模型（冻结）

### 3.1 用户可见四态（禁止混用「就绪」）

| 态 | 含义 | 真源字段 | 允许 UI 文案 |
|----|------|----------|--------------|
| **P 进程** | 8741 有 rushi-asr 且 HTTP 可达 | `healthReachable` / probe | 「侧车进程已连接」 |
| **R 运行时** | ffmpeg + funasr import | `/health.funasr_ready` | 「FunASR 运行时已加载（不含模型权重）」 |
| **A 资产** | 所选 SKU + VAD/标点权重落盘 | D4 catalog + `required_models_cached` | 「模型权重已齐备」 |
| **T 可转写** | R ∧ A ∧ D1=D2 | `computeLocalAsrTranscribeReady` | 「可直接转写」 |

**新增 D7（下载中）**：`prepareModelBusy ∨ prepareModelCancelling ∨ LRC install running` ⇒ **强制** `transcribeReady=false`，banner 走 overlay，**禁止**任何 T 态文案。

### 3.2 侧车 Prepare Job（additive，兼容旧字段）

在现有 `prepare-status` 上 **additive**（不破坏旧客户端）：

```json
{
  "phase": "running",
  "message": "downloading_recognizer",
  "progress_percent": 42,
  "bytes_downloaded": 123456789,
  "bytes_total": 290000000,
  "bytes_total_confidence": "budget",
  "job_id": "prepare-20260620-abc",
  "started_at_ms": 1718880000000,
  "updated_at_ms": 1718880060000,
  "stale": false,
  "error_code": null
}
```

| 字段 | 说明 |
|------|------|
| `job_id` | 每次 `start_prepare_async`（含 force）新生成；UI 可 detect 任务切换 |
| `updated_at_ms` | 进度/phase 最后变化；UI stall 检测、侧车 stale 判定 |
| `stale` | `running` 且 `now - updated_at_ms > STALE_MS`（默认 180s）且无 bytes 增长 |
| `bytes_total_confidence` | `declared` \| `budget` \| `unknown` |

**不变量**

1. `phase=done` ⇒ `progress_percent=100` 且 result 含 path  
2. `phase=error` ⇒ `error_code` 非空；线程已释放（可 force 重启）  
3. `force=true` ⇒ 取消旧线程或 reset idle，新 `job_id`  
4. ModelScope 续传仍走磁盘 cache；**不**第二套 checkpoint 协议

### 3.3 Wizard 步骤语义（一键准备）

| Step | 验收对象 | 终态文案 | 禁止 |
|------|----------|----------|------|
| `sidecar` | P | 「侧车进程已连接」/ skipped | 「侧车已就绪（可转写）」 |
| `health` | R | 「FunASR 运行时已加载」 | 「FunASR 运行时已就绪」不带括号说明 |
| `model` | A | 仅 prepare `done` 后 `ok` | 下载前 `ok`「侧车已加载 XXX」 |
| `done` | T | 「本机 ASR 已可用于转写」 | 在 model 未完成时出现 |

---

## 4. 分期实施（纵向薄片）

### Phase A — P0 UX + 时序（**1 PR，仅 UI 文案 + 时序；`force` API 由前置 P1 改动提供**）

**目标**：消除假就绪闪屏；busy 与 overlay 同步。

| # | 改动 | 文件 |
|---|------|------|
| A1 | `setPrepareModelBusy(true)` + `setAsrModelPrepareActive(true)` **移至** `prepareDefaultFunasrModel` 入口（abort 之后、health 预检之前）；预检 skip 路径在 return 前清 busy | `usePrepareModelController.ts` |
| A2 | 删除 `asrOneClickPrepareModelFlow` 中 sidecar 对齐后的提前 `model` step `ok` | `asrOneClickPrepareModelFlow.ts` |
| A3 | Wizard / diagnose 文案：`侧车已就绪` → `侧车进程已连接`；`FunASR 运行时已就绪` → `FunASR 运行时已加载（不含模型权重）` | `asrSetupState.ts`、`asrOneClickPrepareSidecarHealth.ts`、`asrOneClickPrepareReady.ts`、`asr_setup/diagnose.rs`、`project/transcribe_timeline.rs` |
| A4 | `buildAsrEnvPresentation`：显式 **D7** — `prepareModelBusy` 时 `transcribeReady=false` 且 banner 固定「正在下载模型」 | `asrEnvStatus.ts`（已有 overlay，补测试锁行为） |
| A5 | 去掉 prepare poll 中 `phase=idle` + `/health ready_for_transcribe` 的 **4s 误判完成**；idle 仅在前 4s 显示「正在启动任务」 | `usePrepareModelController.ts` |
| A6 | `desktop-capability-ui-state-alignment.md` 增 D7 行 | 文档 |

**验证**：Vitest 增 `asrSetupState.test.ts`、`usePrepareModelController` 行为测试（busy 前置）；手测 S1。

---

### Phase B — P1 侧车 Job 契约 + 网络健壮（**1 PR，Python + 契约测试**）

**目标**：VPN/瞬断可续传；orphan `running` 可 force；进度可解释。

| # | 改动 | 文件 |
|---|------|------|
| B1 | `prepare_status_body` 输出 §3.2 additive 字段；`start_prepare_async` 生成 `job_id`、维护 `updated_at_ms` | `model_prepare_state.py`、`model_prepare.py` |
| B2 | progress tracker 每次 `add_bytes` / `set_prepare_message` 刷新 `updated_at_ms` | `model_prepare_progress.py` |
| B3 | `stale` 计算：`running` 且超过阈值无 progress 更新 | `model_prepare_state.py` |
| B4 | 已有 `model_prepare_network.py` retry + `force` restart — **补 pytest** 与 `start_prepare_async(force=True)`  stuck 场景 | `tests/test_model_prepare*.py` |
| B5 | Rust watchdog：`loopback_model_prepare_running()` 已有 — 补 **stale job 不杀** 与 **prepare error 后可 restart** 测试 | `asr_sidecar/probe.rs` |
| B6 | UI：stall 检测改用 `updated_at_ms`（fallback 本地 timer）；auto-resume 仅在 `error_code` ∈ resumable 或 `stale=true` | `usePrepareModelController.ts`、`prepareModelResume.ts` |

**验证**：pytest + Vitest；手测 S2、S3。

---

### Phase C — P1 UI 统一轮询层（**1 PR，可选与 B 合并**）

**目标**：一键 / 模型卡 / 环境 banner 读同一 job 视图。

| # | 改动 | 文件 |
|---|------|------|
| C1 | 新 `buildPrepareJobPresentation(st: PrepareStatus)` 纯函数 | `prepareJobPresentation.ts` |
| C2 | `EnvLocalAsrModelCard` + wizard model 步 detail 共用 presentation | 组件 + `asrOneClickPrepareModelFlow.ts` |
| C3 | LRC install 与 prepare **不强行合并 API**；UI 层 `mergeArtifactBusyState(lrcInstall, prepareJob)` 仅合并 D7 | `environmentCapabilityPresentation.ts` |

**验证**：presentation 单测；手测 S1、S5。

---

### Phase D — P2 Supervisor 投影（**独立薄片，依赖 R3h-I1 编码**）

**目标**：诊断包解释「谁在下载」；与 ASR-WARM 共用 FSM。

| # | 改动 | 文件 |
|---|------|------|
| D1 | `SupervisorSnapshot` additive：`preparePhase`、`prepareJobId`、`lrcInstallPhase` | `asr_sidecar/supervisor.rs`（I1a 已部分存在则 extend） |
| D2 | `asr_setup_diagnose` 投影上述字段 | `asr_setup/diagnose.rs` |
| D3 | 导出诊断 zip 含 prepare job 快照 | diagnose export |

**门禁**：不阻塞 Phase A–C；Phase A–C 完成后仍可独立交付。

---

## 5. 不做（显式边界）

| 项 | 原因 |
|----|------|
| 替换 ModelScope / 自研 HTTP 下载器 | LRC plan §0 已锁定 artifact 分离 |
| Ollama 式 NDJSON `/pull` 单端点 | 成本高；Job poll + bytes 足够 v1.1 |
| 合并 LRC 与 prepare 为同一 Rust 下载器 | 违反 postprocess-remote-boundary |
| 在 Phase A 改 `/health` 契约 | additive only 在 prepare-status |
| Supervisor FSM 全量编码 | 归 R3h-I1 / ASR-WARM 路线图 |

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| busy 前置后 cache-hit 仍闪「下载中」 | 预检放 busy 之后、async 启动之前；cache hit 走 fast path ≤3s |
| `ready_for_transcribe` 与所选 SKU 不一致（D1≠D2） | 预检必须含 `funasr_model_id === hubModelId`（已有） |
| 旧版侧车无 `job_id` | additive 字段 optional；UI fallback 现有 phase/message |
| Phase 多 PR 回归 | 每 Phase 独立 gate：`typecheck && test && check-architecture-guard` |

---

## 7. 建议排期与 PR 切分

| 顺序 | Phase | 预估 | PR |
|------|-------|------|-----|
| 1 | **A** P0 UX | 2–3h | `fix(asr): prepare busy overlay and wizard semantics` |
| 2 | **B** Job 契约 + 网络 | 4–6h | `feat(asr): prepare-status job fields and stale detection` |
| 3 | **C** UI presentation | 2–4h | `refactor(asr): unified prepare job presentation` |
| 4 | **D** Supervisor | 路线图 | 跟 R3h-I1/ASR-WARM |

**打包验证**：每 Phase 完成后 `bash scripts/r3f-fresh-appdata-hand-test.sh` + VPN 切换手测 S2。

---

## 8. 签收

- [x] Research brief 链接
- [x] 状态模型 §3 冻结
- [x] Phase A–D 落位
- [ ] 用户确认 → 开 Phase A 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版：四态模型 + A–D 分期 + PR 切分 |
