# 调研：ASR 侧车下载 / 安装与状态展示架构

> **状态**：已采纳（2026-06-20）  
> **触发**：用户反馈「刚开始下载时先提示侧车就绪，再开始下载」；VPN 切换后断点续传不稳  
> **关联**：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) · [`asr-runtime-readiness-and-concurrency-research.md`](./asr-runtime-readiness-and-concurrency-research.md) · [`r3h-i1-runtime-supervisor-fsm-research.md`](./r3h-i1-runtime-supervisor-fsm-research.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 一键准备或点「下载当前模型」时，先看到「侧车已就绪 / FunASR 运行时已就绪」，随后才进入模型下载；用户误以为已全部完成。VPN/代理切换后下载中断，期望断点续传但体验不稳定。 |
| **本仓现状** | 三套并行状态源：**Rust LRC 安装**（`localRuntimeDiagnose.install`）、**Python prepare**（`/v1/models/prepare-status`）、**侧车 health**（`/health`）；UI 在 wizard / 环境 banner / 模型卡片三处拼装；`pollUntilHealth` 只等 `funasr_ready`，不等权重落盘。 |
| **成功标准** | 用户从任意入口开始下载时，**全程不出现「可转写 / 侧车就绪」类终态文案**，直到 D4（所选 SKU 权重齐备）+ D2 对齐；断网/VPN 切换后可自动或一键续传，进度不跳零。 |

### 1.1 「先就绪再下载」根因（代码对照）

| 现象 | 根因 | 关键文件 |
|------|------|----------|
| Wizard 侧车/健康步打勾，模型步才开始 | 流水线按 **进程/运行时** → **权重** 两阶段；health 步验收 `funasr_ready`，不是 `ready_for_transcribe` | `asrOneClickPrepareSidecarHealth.ts`、`useAsrSetupHealthFlow.ts` |
| 诊断快照显示「侧车已就绪」 | `healthReachable` 即 `skipped` + 文案「侧车已就绪」，与模型是否下载无关 | `asrSetupState.ts` `stepsFromReport` |
| 模型步先显示「侧车已加载 XXX」再下载 | `sidecarMatchesSelection` 通过后 patch 为 `ok`，随后才 `prepareDefaultFunasrModel` | `apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts` L97–102 |
| 点下载瞬间 banner 仍像就绪 | `prepareModelBusy` 在 health 预检 **之后** 才置 true；预检窗口内 `buildAsrEnvPresentation` 仍用旧 caps | `apps/desktop/src/pages/usePrepareModelController.ts` L116–145 |
| prepare idle 时误判完成 | phase=`idle` 超过 4s 会读 `/health`，若 `ready_for_transcribe` 则提前 return（与 prepare 线程竞态） | `apps/desktop/src/pages/usePrepareModelController.ts` L244–261 |

**维度误用（对齐 doc §2）**：把 **D5 运行时**（`funasr_ready` / health 可达）当成 **D4 所选 SKU 权重** 或 **D5 完整转写就绪**（`ready_for_transcribe` + D1=D2）。

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| **A** | **单操作 + 流式进度** | [Ollama `/api/pull`](https://github.com/ollama/ollama/blob/main/docs/api.md) | 同一 POST 返回 NDJSON：`status` + `total`/`completed`；取消可续传；多客户端 attach 同一 pull | GitHub `ollama/ollama` docs/api.md |
| **B** | **Job 模型 + 状态轮询** | [LM Studio Download API](https://lmstudio.ai/docs/developer/rest/download-status) | `POST /models/download` → `job_id`；`GET .../status/:job_id` 返回 `downloading\|paused\|completed\|failed\|already_downloaded` + bytes + timestamps | lmstudio.ai REST docs |
| **C** | **缓存层断点 + 内置重试** | [Hugging Face `huggingface_hub`](https://huggingface.co/docs/huggingface_hub/main/package_reference/file_download) | 文件级 `.incomplete` + ETag；`http_get` 对 ConnectionError/ReadTimeout 自动 resume；`snapshot_download` 并发 worker | HF hub file_download.py |
| **D** | **分层 readiness 探针** | Kubernetes readiness / liveness | **Liveness**=进程活着；**Readiness**=依赖齐备才可接流量；禁止用 liveness 表示「业务就绪」 | K8s docs（概念对照） |
| **E** | **桌面 Supervisor + 单一相位真源** | VS Code extension host、Electron utilityProcess | 父进程 FSM + health probe；UI 只读 SupervisorSnapshot，不拼 HTTP 多源 | 本仓 [`r3h-i1-runtime-supervisor-fsm-research.md`](./r3h-i1-runtime-supervisor-fsm-research.md) |

**ModelScope（本仓实际依赖）**：`snapshot_download` 走 Hub 缓存目录断点（非 Rushi 自研 checkpoint）；VPN 问题多为 **线程挂死 + prepare phase 未释放**，而非缓存层不支持续传。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / UX |
|------|--------|----------------|-------------------|------------------|
| **A Ollama pull 流** | 中 | 单 endpoint 进度、续传语义清晰 | FastAPI 侧车已有多路由；Tauri 需 NDJSON 客户端；ModelScope 回调非 pull 形态 | 低延迟进度；需长连接 |
| **B LM Studio job** | **高** | `job_id`、bytes、phase enum、attach 语义 | 须统一 LRC install + model prepare 为同一 Job 形状 | 轮询 500ms–1s 可接受 |
| **C HF 式文件 resume** | **高**（已部分） | 继续用 ModelScope cache + 外层 transient retry | 勿 fork 第二套下载器 | 依赖 Hub；VPN 需 force 重启 prepare 线程 |
| **D 分层 readiness** | **高**（已部分） | `/health` 已有 `funasr_ready` / `ready_for_transcribe` / `selected_model_ready` | UI/wizard 仍混用字段 | 无额外内存 |
| **E Supervisor FSM** | 中 | Rust 侧统一「侧车相位 + 安装相位 + 模型 prepare 相位」投影 | I1 设计未编码；与 ASR-WARM 耦合 | 诊断包可解释性强 |

**本仓已有可复用模块（须扩展而非重造）**

- Python：`model_prepare_state.py`、`model_prepare_progress.py`、`model_prepare_network.py`
- UI：`usePrepareModelController.ts`、`applyPrepareModelOverlay`（`asrEnvStatus.ts`）
- Rust LRC：`local_runtime` install progress（bytes + phase）— **形状优于 prepare，但未与 FunASR 权重下载统一**
- 能力对齐：`computeLocalAsrTranscribeReady`、`selectedModelPrepareState`（D1–D4）

---

## 4. 差距清单（相对业内 B + D + E）

| 优先级 | 差距 | 现状 | 成熟做法 | 建议 |
|--------|------|------|----------|------|
| **P0** | **就绪语义混叠** | Wizard/诊断用「侧车已就绪」表示 health 可达 | Readiness 仅表示 **权重+配置齐备**；进程存活单独一行 | Wizard health 步改「运行时进程就绪（不含模型）」；终态 `done` 才用「可转写」 |
| **P0** | **prepare 与 UI busy 竞态** | 预检 health 时 `prepareModelBusy=false` | 点击下载 **同步** 置 busy + banner overlay | `setPrepareModelBusy(true)` 移到函数第一行 |
| **P0** | **模型步 ok 早于下载** | `sidecarMatchesSelection` → step `ok` 再 download | 模型步保持 `running` 直到 prepare `done` | 删掉 L97–102 的提前 `ok` patch |
| **P1** | **无双真源 Job API** | prepare：`phase`+`message`；LRC：另一套 `install` | 统一 `ArtifactJob`：`job_id`、`artifact_kind`、`status`、`bytes_*`、`error_code` | 侧车 additive JSON；UI 单一 `useArtifactJobPoll` |
| **P1** | **仅 poll 无 push** | 1s GET `/prepare-status` | Ollama NDJSON 或 LM Studio 500ms job poll + speed | 短期加强 poll + bytes；中期 optional SSE |
| **P1** | **进度真源弱** | 无 Content-Length 时用 budget 估算 | LM Studio 始终返回 `total_size_bytes` 或 `unknown` | prepare-status 增加 `bytes_total_confidence: declared\|budget\|unknown` |
| **P1** | **VPN/孤儿任务** | force restart + auto-resume（近期已加） | LM Studio `attachToExistingDownload` + daemon 清 orphan | 侧车 `prepare-status` 增 `stale_since`；Rust watchdog 与 prepare 联动 |
| **P2** | **Supervisor 无 prepare 相位** | Rust probe 知 prepare running，UI 不知 FSM | SupervisorSnapshot 投影 prepare/LRC | 跟 R3h-I1 / ASR-WARM 一并做 |
| **P2** | **三入口三 UX** | 一键 / 模型卡 / LRC 面板各一套文案 | 单一「本机资产准备」状态机 | 复用 `buildAsrEnvPresentation` + wizard 同步 |

---

## 5. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **短期（P0 UX）**：修正 wizard/模型步语义 + busy 时序，不新增 API。**中期（P1）**：侧车 additive **ArtifactJob** 字段（对齐 LM Studio job 形状），UI 统一轮询层。**长期（P2）**：Supervisor FSM 投影 LRC + sidecar + prepare，禁止 UI 直接拼 `/health` + diagnose + prepare 三源。 |
| **不做什么** | 不替换 ModelScope 下载器；不引入第二套 checkpoint 协议；不在 v1.1 做 NDJSON pull 大改（除非 job 轮询仍不够） |
| **与既有 research 关系** | 分层 readiness 延续 [`asr-runtime-readiness-and-concurrency-research.md`](./asr-runtime-readiness-and-concurrency-research.md)；进程相位延续 [`r3h-i1-runtime-supervisor-fsm-research.md`](./r3h-i1-runtime-supervisor-fsm-research.md) |
| **VPN 续传** | 信任 ModelScope cache + prepare `force` 重启；UI auto-resume 2 次；侧车 transient retry 3 次（已实现，待打包验证） |

---

## 6. 落位预告（非最终实现）

| 层 | 文件 | 变更类型 |
|----|------|----------|
| UI P0 | `asrSetupState.ts`、`asrOneClickPrepareSidecarHealth.ts`、`asrOneClickPrepareModelFlow.ts` | 文案 / 步骤状态机 |
| UI P0 | `usePrepareModelController.ts` | busy 前置；去掉 idle→health 误判 |
| Python P1 | `model_prepare_state.py`、`app.py` | additive job 字段 |
| UI P1 | 新 `useAsrArtifactJobPoll.ts`（或扩展现有 controller） | 统一 LRC + prepare poll |
| Rust P2 | `asr_sidecar/supervisor.rs` | 投影 prepare + LRC phase |
| 测试 | wizard presentation、prepare busy 时序、job shape 契约 | Vitest + pytest |
| 文档 | `desktop-capability-ui-state-alignment.md` §2 增 **D7 资产下载中** | 禁止 busy 时显示 transcribeReady |

---

## 7. 签收

- [x] 调研 brief 完成（2026-06-20）
- [x] Plan：[asr-model-download-status-remediation-plan.md](./asr-model-download-status-remediation-plan.md)
- [x] Acceptance：[asr-model-download-status-remediation-acceptance.md](./asr-model-download-status-remediation-acceptance.md)
- [ ] 用户确认 Phase A → 开编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版：侧车就绪闪屏根因 + Ollama/LM Studio/HF 对照 + 差距表 |
| 2026-06-20 | 链接 plan/acceptance 三件套 |
