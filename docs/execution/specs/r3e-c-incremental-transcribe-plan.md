# Plan: R3e-C — 转写增量出段（实时预览语段）

> **状态**：规划定稿 · **未编码**  
> **Epic ID**：**R3e-C**（R3e 长音频子切片；**非** STREAM mic 流式）  
> **前置**：R3e-B ✅（侧车 `transcribe_by_windows`）、R3t-B ✅（`project_run_transcribe` 原子写库）  
> **关联**：[`r3e-b-long-audio-chunking-research.md`](./r3e-b-long-audio-chunking-research.md) §4.4、[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)、[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)  
> **Research brief**：[`r3e-c-incremental-transcribe-research.md`](./r3e-c-incremental-transcribe-research.md)  
> **影响面审查**：[`r3e-c-incremental-transcribe-impact.md`](./r3e-c-incremental-transcribe-impact.md)

---

## 1. 目标（一句话）

**长音频本机转写过程中**，用户在编辑器内 **逐步看到语段与文本**（按侧车窗口推进），而不是等整轨 Job 结束才一次性刷新；**终稿仍一次原子写 SQLite**，失败/取消 **不落脏库**。

## 2. 非目标（v1）

| 不做 | 说明 |
|------|------|
| mic / 真流式 partial token | 属 **STREAM-***，本切片仅 **文件 batch 分窗** |
| partial 写 SQLite | 预览仅 **内存**；成功后才 `file_save_segments` |
| 转写中 LLM 自动标点/校对 | 属 R3t-C/E；R3e-C **禁用** LLM 校准按钮或显式 block |
| 转写中编辑语段并参与后续 ASR | 预览 **只读**；`busyReason=transcribe` 禁 mutation |
| 桌面多 HTTP 分片循环 | Q2：**侧车内 Job** + 桌面轮询/event |
| 断点续传跨重启 | T-004 / R3h-2 |
| 在线 STT 增量 | v1 **仅本机 FunASR**；在线仍 blocking 一次返回 |

## 3. 问题与成功标准

| 项 | 内容 |
|----|------|
| **用户场景** | 30～60min 录音点「拉取语段」后 **数分钟内** 看到首批语段，可滚动波形/列表，不必干等 10+ 窗全部完成 |
| **现状** | `project_run_transcribe` 单次 await `POST /v1/transcribe`；R3e-B 窗内循环但 **响应一次返回** |
| **成功标准** | 50min 手测：**首窗 segments 可见时间** ≪ 整 Job 墙钟；终稿 segments 与现 blocking 路径 **一致**（同一 pytest + 抽样 diff）；取消/失败 **DB 与转写前一致** |

## 4. 架构决策

### 4.1 两态语段

```text
preview_segments（React state + 侧车 Job 内存）
  · status: transcribing_preview
  · 可 append/replace 列表，uid 临时
  · 不写 SQLite、不算用户 dirty、undo 不记录

stable_segments（Job done + normalize + save）
  · 一次 file_save_segments
  · 与现 R3t L3 相同
```

**硬规则**（对齐 [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)）：

- L4 LLM **仅**对 stable；预览段 **不得**触发 `postprocess_*`。
- Job 成功：用终稿 **整表替换** preview（含 `trimAdjacentSegmentOverlaps` 等，与现 parse 路径相同）。
- Job 失败/取消：**丢弃** preview，恢复转写前 `segments` 快照。

### 4.2 Job 模型（仿 prepare-status）

```text
桌面  project_run_transcribe
        → POST /v1/transcribe/async  { multipart: file, hotwords, job_id? }
        ← { job_id, accepted: true }

      轮询 GET /v1/transcribe-status?job_id=
        ← { phase, window_index, window_count, segments_delta[], warnings[], error? }

      phase=done → 桌面 parse 全量 segments（或与 delta 累积一致）→ save → closeGate.openFile

      phase=error | 用户取消 → POST /v1/transcribe/cancel { job_id }
```

| 字段 | 含义 |
|------|------|
| `phase` | `queued` \| `normalizing` \| `transcribing` \| `merging` \| `done` \| `error` \| `cancelled` |
| `window_index` / `window_count` | R3e-B 窗进度（短音频 `window_count=1`） |
| `segments_delta` | **本 tick 新增** segments（已 offset 到全局时间）；空数组表示仅心跳 |
| `segments_total` | 可选；累积段数，供 UI 副标题 |

**为何不用 SSE v1**：prepare 已验证 **轮询 + loopbackFetch**；Tauri 侧不必先上 Event 流。v1.1 可再加 `listen('transcribe-progress')` 降 poll 开销。

### 4.3 侧车执行（单进程 Job）

- **一个** `/v1/transcribe/async` 仍读整文件；normalize 后走现有 `engine.transcribe_upload` 逻辑，但长音频路径改为 **可报告进度的 coordinator**：
  - 复用 `transcribe_by_windows` 循环体；
  - 每窗 `generate_and_parse_funasr` + offset 后 **append 到 JobState**；
  - 短音频 / 非 windowed：normalize 完成后 **一次** generate，仍走 `phase=done` 单次 delta。
- **blocking** `POST /v1/transcribe` **保留**（兼容、测试、在线路径不变）；桌面本机长音频改走 async。

### 4.4 终稿一致性

Job `done` 时侧车返回的 `segments[]` **必须**与「若走 blocking 同一输入」在以下方面一致：

- 段数、起止时间、`segmentation_mode`、`warnings`（允许 preview 阶段少 `correction_rule_hints`，**done 前**在侧车或桌面补全与现路径相同逻辑）。

**验收**：同一 wav 手测 blocking vs async **segmentsEqualForPersist**（抽样 3 条长音频）。

### 4.5 取消与失败

| 事件 | 行为 |
|------|------|
| 用户取消 | 侧车设 cancel flag；当前窗跑完 **不再开新窗**；phase=`cancelled`；桌面丢弃 preview |
| 侧车 OOM/窗失败 | phase=`error`；**不写库**；文案沿用/扩展 `funasr_window_failed` |
| 轮询超时 | 桌面总超时仍用 R3e-A **按音频时长**；超时后尝试 cancel + 报错 |
| 8741 重启 | Job 丢失 → 桌面检测 `404`/`unknown job` → 报错并清 preview |

## 5. 分阶段交付

### Phase 0 — L0 仅进度（可选先行，0.5～1d）

- 侧车仅 log → **不做**；桌面 busy 副标题读 **假进度** 无价值。
- **跳过**；直接与 Phase 1 合并。

### Phase 1 — MVP（推荐首 PR，≈1～1.5 周）

| 能力 | 说明 |
|------|------|
| async Job + status API | 侧车 `TranscribeJobTracker` + 3 endpoints |
| 桌面轮询 | Rust `project_run_transcribe` 内 poll 或拆 `project_poll_transcribe` |
| UI preview | `setSegments(preview)`；overlay 标「转写预览中」；禁编辑 |
| 进度文案 | `ProjectStatusFeedback`：`第 i/N 段` + 已出段数 |
| 原子 save | Job done 后现有 save 路径 |
| 失败/取消 | 无脏库 |
| 范围 | **仅本机 FunASR**；`duration >= WINDOW_THRESHOLD` 优先 |

### Phase 2 —  polish（≈3～5d）

| 能力 | 说明 |
|------|------|
| 短音频也走 async | 统一代码路径；`window_count=1` |
| Tauri event | 可选替代 500ms poll |
| 取消按钮 | 工具栏「停止转写」 |
| 首段可见 SLA | 手测清单 + log `first_segments_visible_ms` |

### Phase 3 — 明确不做于 R3e-C

- LLM 窗间 prompt、Whisper 双引擎、partial SQLite、STREAM mic。

## 6. 落位文件

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `services/asr/rushi_asr/transcribe_job.py` **新** | JobState、tracker、cancel |
| Python | `services/asr/rushi_asr/transcribe_windows.py` | 注入 progress callback |
| Python | `services/asr/rushi_asr/engine.py` | windowed 路径走 job coordinator |
| Python | `services/asr/rushi_asr/app.py` | `POST transcribe/async`、`GET transcribe-status`、`POST transcribe/cancel` |
| Python | `services/asr/tests/test_transcribe_job.py` **新** | mock 多窗 delta |
| Rust | `apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs` | async 启动 + poll loop |
| Rust | `apps/desktop/src-tauri/src/project/transcribe_job.rs` **新** | poll 解析、redact log |
| TS | `apps/desktop/src/pages/useTranscribeJobController.ts` | preview segments、快照恢复 |
| TS | `apps/desktop/src/pages/transcribePreviewState.ts` **新** | 纯函数：merge delta、快照 |
| TS | `apps/desktop/src/components/ProjectStatusFeedback.tsx` | i/N 副标题 props |
| TS | `apps/desktop/src/services/asrTranscribeHints.ts` | `transcribe_preview` / cancel hints |
| 文档 | 本文件 + `r3e-c-incremental-transcribe-acceptance.md` **新** | 签收 |

## 7. API 草案（侧车）

### POST `/v1/transcribe/async`

- 与 sync 相同 multipart：`file`, `hotwords`。
- Response: `{ "job_id": "uuid", "schema_version": "1" }`。

### GET `/v1/transcribe/status?job_id=`

```json
{
  "job_id": "...",
  "phase": "transcribing",
  "window_index": 3,
  "window_count": 10,
  "segments_delta": [ { "start_sec", "end_sec", "text", ... } ],
  "segments_total": 42,
  "warnings": ["transcribe_windowed:windows=10"],
  "error": null
}
```

### POST `/v1/transcribe/cancel`

- Body: `{ "job_id": "..." }` → `{ "cancelled": true }`。

## 8. 桌面编排（React）

```text
requestTranscribe
  → snapshot segmentsRef（恢复用）
  → beginBusy("transcribe")
  → invoke project_transcribe_async_start
  → loopbackFetch 轮询 GET /v1/transcribe/status：
       merge segments_delta → setSegments(preview)
       setTranscribeProgress({ i, n, total })
  → done：project_transcribe_async_finalize
       normalizeSegmentList(final) → save → openFile → resetMutationHistory
  → error/cancel：
       setSegments(snapshot) → setError
  → endBusy
```

- **overwrite 对话框**：逻辑不变；确认后进入上述 flow。
- **canSave / dirty**：preview 期间 **false**（或不触发 dirty）。

## 9. 能力—UI 状态矩阵

| UI 控件 / 文案 | 维度 | 数据源 | 手测 |
|----------------|------|--------|------|
| Busy 遮罩标题 | 转写 Job | `busyReason=transcribe` | 长音频转写中始终显示 |
| 副标题「第 i/N 段」 | 侧车 Job | `window_index/window_count` | 20min（120s 窗）出现 i 递增；短音频 N=1 或隐藏 |
| 语段列表可编辑性 | preview vs stable | `transcribePreviewActive` | 预览中点击编辑无效或只读 |
| LLM 自动标点按钮 | L4 门禁 | `transcribePreviewActive` → block | 预览中 disabled + reason |
| 拉取语段就绪 | D1+D5 | 同现 `localTranscribePreflight` | 与 blocking 一致 |
| 在线 STT 拉取 | 在线通道 | 仍 blocking | 无 i/N；hint 说明仅本机长音频增量 |

**手测矛盾场景（必填）**

1. 预览中段数增加时 **滚动/选中 idx** 不崩溃；终稿到达后选中策略可接受（建议：保持 idx 或选首段新内容）。  
2. 预览中 **取消** → 段列表与转写前 byte-equal（persist 语义）。  
3. D1 Paraformer + **20min** → 首 **120s 窗**结束后可见段 **早于** 整 Job 完成。

## 10. 测试策略

| 层 | 内容 |
|----|------|
| Python | Job tracker 单元；mock 3 窗 delta 顺序与 offset |
| Rust | status JSON parse；cancel 转发 |
| TS | `mergeTranscribeSegmentsDelta`；preview 时 block save |
| 手测 | [`r3e-c-incremental-transcribe-hand-test-checklist.md`](./r3e-c-incremental-transcribe-hand-test-checklist.md)（Phase 1 末写） |
| 回归 | 现有 `test_transcribe_windows.py` + blocking `/v1/transcribe` 不破坏 |

## 11. 风险

| 风险 | 缓解 |
|------|------|
| preview 与终稿 diff 大 | done 整表替换 + toast「转写已完成，语段已更新」 |
| uid 预览/终稿不一致 | preview 用临时 uid；**save 前** `ensureSegmentUids` 与现路径一致 |
| 轮询 CPU | 500ms～1s interval；Phase 2 event |
| 双路径 drift | 共享 `transcribe_by_windows` 核心；contract test blocking ≡ async final |
| 架构 hotspot | controller 逻辑进 `useTranscribeJobController` + 纯函数，Orchestrator 只绑 props |

## 12. 排期与依赖

| 关系 | 说明 |
|------|------|
| **R3e-B** | 硬依赖；无窗循环则无可增量内容 |
| **R3t-D/E** | 正交；**R3e-C 应先于**「转写中 LLM」任何设计 |
| **STREAM-*** | 不复用 Job API；未来 mic 另立项 |
| **路线图** | 建议插入 **R3e-B 签收后、R3t-D 前**，预估 **1～1.5 周**（Phase 1） |

## 13. 验证命令（签收）

```bash
python3 -m pytest services/asr/tests/test_transcribe_job.py services/asr/tests/test_transcribe_windows.py -q
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml transcribe_job
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
# 手测：50min 样本首段可见 + 终稿 blocking diff 抽样
```

---

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 初版：R3e-C 增量出段 plan（Job + 轮询 + preview 两态） |
| 2026-05-30 | 链接 research + impact 审查文档 |
