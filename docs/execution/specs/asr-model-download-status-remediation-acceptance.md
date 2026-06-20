# Acceptance: ASR 侧车下载 / 安装 / 状态展示 — 可靠健壮收口

> **Research**：[asr-model-download-status-architecture-research.md](./asr-model-download-status-architecture-research.md)  
> **Plan**：[asr-model-download-status-remediation-plan.md](./asr-model-download-status-remediation-plan.md)  
> **状态**：规划（2026-06-20）— 编码前验收清单

---

## 1. 目标

验收 Phase A–C 完成后，本机 ASR 资产准备链路满足 plan §2 成功定义 S1–S5；VPN 续传与假就绪问题不再复现。

---

## 2. 能力—UI 状态矩阵（必填）

> 维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)

| UI 控件 / 文案 | 状态维度 | 数据源 | 手测场景 |
|----------------|----------|--------|----------|
| 顶栏 ASR chip | D7（下载中压制 T） | `buildAsrEnvPresentation(prepareModelBusy)` | 下载中 chip=「ASR 未就绪」，非「已就绪」 |
| 环境 banner 标题 | D7 | `applyPrepareModelOverlay` | 下载中 banner=「正在下载模型」 |
| Wizard `sidecar` 步 | P | diagnose / one-click sidecar health | 仅表示进程，不含权重 |
| Wizard `health` 步 | R | `funasr_ready` | 文案含「不含模型权重」 |
| Wizard `model` 步 | A + D7 | prepare-status / prepare busy | 下载完成前不得 `ok` |
| Wizard `done` 步 | T | `computeLocalAsrTranscribeReady` | 仅 model 完成后出现 |
| 模型卡进度条 | D1+D4+D7 | `prepareModelProgress` + catalog | 所选 SKU 未齐备时不得 100% 绿 |
| 模型卡 status 行 | D4 | `selectedModelPrepareState` | Paraformer 未下完不得显示「已缓存」 |
| 转写按钮 blockReason | T | `asrEnvPresentation.blockReason` | 下载中 block「所选模型正在下载」 |

---

## 3. 矛盾场景手测（至少 2 组，必填）

### 场景 M1 — 下载中假就绪（P0 核心）

#### M1a — 从一键准备进入

**前置**：侧车已启动（`funasr_ready=true`），所选 Paraformer **未**下载完。

**前置**：侧车已启动（`funasr_ready=true`），所选 Paraformer **未**下载完。

| 步骤 | 期望 |
|------|------|
| 1. 点「下载当前模型」或一键准备进入 model 步 | **立即** banner/chip 变为「正在下载」，**不**出现「侧车、FFmpeg 与模型已就绪」 |
| 2. 观察 wizard | `sidecar`/`health` 可为 skipped/ok，但文案 **非**终态「可转写」；`model` 为 running |
| 3. 等待 prepare `done` | 此时才 `done` ok + 顶栏可转写 |

#### M1b — 从环境页模型卡进入

**前置**：同 M1a。

| 步骤 | 期望 |
|------|------|
| 1. 环境页点模型卡「下载当前模型」 | **立即** banner/chip 变为「正在下载」，**不**出现「侧车、FFmpeg 与模型已就绪」 |
| 2. 等待 prepare `done` | 完成后模型卡显示已缓存，顶栏可转写 |

### 场景 M2 — D4 与 D5 不一致

**前置**：磁盘仅有 SenseVoice 缓存；UI 选 Paraformer；侧车 `funasr_model_id` 仍为 SenseVoice。

| 步骤 | 期望 |
|------|------|
| 1. 环境页 | 提示「所选模型未应用到侧车」或「请下载当前模型」，**不**用全局 `required_models_cached` 显示 100% |
| 2. 下载 Paraformer | 进度绑定 Paraformer，非 SenseVoice |

### 场景 M3 — VPN 切换续传（P1 核心）

**前置**：fresh app data，侧车 ready，开始下载大模型。

| 步骤 | 期望 |
|------|------|
| 1. 下载至 20%–50% | 进度持续增长 |
| 2. 开启或关闭 VPN 一次 | 出现「续传」类提示或自动 retry；**进度不跳回 0**（允许短暂 stall） |
| 3. 最终 | `done` 或明确 `model_prepare_network_error` + 可重试；ModelScope cache 保留 |

### 场景 M4 — prepare running 时 health 瞬断

**前置**：下载进行中。

| 步骤 | 期望 |
|------|------|
| 1. 模拟侧车忙（或 VPN 导致单次 /health 失败） | 顶栏 **不**降级为「无法连接侧车」；不杀侧车 |
| 2. 恢复网络 | 进度 poll 恢复 |

---

## 4. Phase 验收闸门

### Phase A — P0 UX（无 API 变更）

| ID | 项 | 证据 |
|----|-----|------|
| A-1 | busy 前置：点击下载后同一 tick 内 `prepareModelBusy=true` | Vitest + 手测 M1 |
| A-2 | 无提前 model step `ok` | 代码审查 + 手测 M1 |
| A-3 | Wizard 文案区分 P/R/T | `asrSetupState` 单测 |
| A-4 | 无 idle→health 误判完成 | Vitest prepare poll mock |
| A-5 | D7 overlay 锁 transcribeReady | `asrEnvStatus.test.ts` |
| A-6 | `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` | CI 本地 |

### Phase B — Job 契约 + 网络

| ID | 项 | 证据 |
|----|-----|------|
| B-1 | `prepare-status` 含 `job_id`、`updated_at_ms`（additive） | pytest `test_prepare_status` |
| B-2 | `stale=true` 当 running 无 progress 更新 >180s | pytest |
| B-3 | `force=true` 释放 stuck `running` | pytest |
| B-4 | transient network → `model_prepare_network_error` + retry | `test_model_prepare_network.py` |
| B-5 | watchdog 不因 prepare running 报 health_lost | Rust probe test |
| B-6 | UI auto-resume ≤2 次 on resumable error | Vitest |
| B-7 | 手测 M3、M4 通过 | 手测记录 |

### Phase C — UI presentation 统一

| ID | 项 | 证据 |
|----|-----|------|
| C-1 | `buildPrepareJobPresentation` 单测覆盖 phase/message/bytes | Vitest |
| C-2 | 模型卡与 wizard model 步 detail 同源 | 快照或单测 |
| C-3 | `mergeArtifactBusyState` LRC+prepare D7 | Vitest |

### Phase D — Supervisor（可选，路线图）

| ID | 项 | 证据 |
|----|-----|------|
| D-1 | diagnose 含 prepare job 投影 | diagnose test |
| D-2 | 诊断 zip 可解释下载态 | 导出手测 |

---

## 5. 自动化测试清单（Implement 时 TDD）

| 文件 | 覆盖 |
|------|------|
| `asrSetupState.test.ts`（新） | `stepsFromReport` 文案 P/R/A |
| `asrEnvStatus.test.ts` | D7 busy overlay |
| `prepareModelResume.test.ts` | resumable error codes |
| `prepareJobPresentation.test.ts`（新，Phase C） | bytes/confidence/stale |
| `usePrepareModelController` 行为测试（新或扩） | busy 前置、无 idle 误判 |
| `test_model_prepare.py` | force restart、status shape |
| `test_model_prepare_network.py` | transient retry |
| `asr_sidecar/probe` tests | prepare running gate |

---

## 6. 机器守卫（每 Phase 必跑）

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
cd services/asr && python3 -m pytest tests/test_model_prepare.py tests/test_model_prepare_network.py -q
```

Rust（Phase B 若改 probe）：

```bash
cargo test -p rushi-desktop asr_sidecar::probe -- --nocapture
```

---

## 7. 结论分支

| 结果 | 动作 |
|------|------|
| **Phase A Go** | 合并 PR1；开 Phase B |
| **Phase B+C Go** | 打 dev/release 包；手测 M1–M4 |
| **M3 仍失败** | 查 ModelScope cache 路径 + sidecar 日志；不扩大 scope 到自研下载器 |
| **Defer Phase D** | A–C 可独立发布；Supervisor 跟 R3h-I1 |

---

## 8. 签收

| 项 | 状态 |
|----|------|
| Research 链接 | ☑ |
| Plan 链接 | ☑ |
| 能力—UI 矩阵 | ☑ |
| 手测 M1–M4 | ☐ 编码后执行 |
| Phase A–C 闸门 | ☐ |

**确认后下一步**：仅开 **Phase A** 编码（最小 diff、最快消除假就绪）。
