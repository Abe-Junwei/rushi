# R3e-C 影响面与改动边界审查

> **状态**：规划审查（2026-05-30）  
> **Plan**：[`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md)  
> **Research**：[`r3e-c-incremental-transcribe-research.md`](./r3e-c-incremental-transcribe-research.md)

本文档列出 **允许改 / 禁止改 / 需回归** 的边界，避免 R3e-C 波及其他 Epic（R3t LLM、在线 STT、eval、导出）。

---

## 1. 改动边界总图

```text
                    ┌─────────────────────────────────────┐
                    │  允许改（R3e-C scope）                 │
                    │  · 侧车 async/status/cancel           │
                    │  · transcribe_windows progress hook   │
                    │  · run_transcribe 本机长音频分支       │
                    │  · useTranscribeJobController preview │
                    │  · ProjectStatusFeedback i/N          │
                    │  · transcribePreviewState 纯函数      │
                    └─────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
   │ 禁止改逻辑    │           │ 只读/禁入     │           │ 回归必跑      │
   │ · online STT │           │ · LLM L4     │           │ · blocking   │
   │ · eval 脚本  │           │ · correction │           │   /transcribe│
   │ · segment    │           │   _memory    │           │ · r3e-b 窗   │
   │   save 语义  │           │   on preview │           │ · gate tests │
   └──────────────┘           └──────────────┘           └──────────────┘
```

---

## 2. 按功能域影响矩阵

| 功能域 | 现行为 | R3e-C 后 | 是否改代码 | 风险 | 缓解 |
|--------|--------|----------|------------|------|------|
| **本机长音频转写** | blocking HTTP | async + preview + 终稿 save | **是** | 双路径 drift | blocking 保留；final parity 手测 |
| **本机短音频** | blocking | Phase1 仍 blocking；Phase2 可选 async | **Phase1 否** | 无 | 阈值与 R3e-B `WINDOW_THRESHOLD` 一致 |
| **在线 STT** | native/multipart blocking | 不变 | **否** | 用户困惑 | hints：增量仅本机 |
| **overwrite 对话框** | 非空段确认 | 不变（Job 前） | **否** | — | — |
| **busy / mutation** | transcribe 禁编辑 | 保持禁编辑 | **Partial** | 用户改 preview | `busy` 仍 true；可选 preview 只读样式 |
| **dirty / 未保存** | 对比 savedSnapshot | preview **不进** snapshot | **是** | 误报未保存 | 不 `setSavedSnapshot` 直到 openFile |
| **closeGate / 切文件** | 未保存拦截 | transcribe 中应 **拦截** 切走 | **Partial** | preview 丢失 | busy 时 disable 导航或 confirm |
| **手动保存** | saveSegments | busy 仍禁止 | **否** | — | — |
| **自动标点 R2/R3t-C** | busy 禁 | + previewActive 禁 | **Partial** | 误触发 LLM | blockReason 文案 |
| **R3t-D/E** | stable 段 ops | preview 不可用 | **否** | — | 门禁 flag |
| **correction_memory** | save/transcribe 后学习 | **仅** 终稿 save 后 | **否** | preview 触发学习 | 不写 DB → 不触发 |
| **波形 peaks** | 随 file 加载 | 不依赖 transcribe | **否** | — | — |
| **语段 overlay** | 随 segments 变 | preview 段增多时重绘 | **Partial** | 性能/选中 | 手测 50min 密度 |
| **导出 TXT/SRT** | busy 禁 | 保持 | **否** | 导出 preview | 已 busy 禁 |
| **eval-run.py** | blocking POST | 不变 | **否** | — | — |
| **P0 / r3t-a 脚本** | blocking | 不变 | **否** | — | — |
| **prepare-model** | 独立 busy | 并行时两 busy 互斥 | **Partial** | 双长任务 | 文档：勿同时转写+下载 |
| **架构守卫** | hook 行数 | controller 勿膨胀 | **Watch** | hotspot | 纯函数下沉 |

---

## 3. 关键交互序列（必须遵守）

### 3.1 成功路径

```text
1. requestTranscribe → overwrite? → snapshotSegmentsForPersist → beginBusy
2. POST async → poll → mergeTranscribeSegmentsDelta → setSegments (NO setSavedSnapshot)
3. phase=done → Rust: parse final → file_save_segments_inner → collect_correction hints
4. openFileWrapped → setSavedSnapshot → resetMutationHistory → hints → endBusy
5. optional toast: 「转写已完成，语段已更新」
```

### 3.2 失败 / 取消

```text
1. snapshot 恢复 setSegments
2. 不调用 file_save_segments
3. clearTranscribeProgress → endBusy → setError
```

### 3.3 禁止序列

| 禁止 | 原因 |
|------|------|
| preview 期间 `file_save_segments` | 脏库、correction_memory |
| preview 期间 `openFileWrapped` | 把 preview 当 savedSnapshot |
| preview 期间 `postprocess_*` | 违反 L4 stable 门禁 |
| done 后不 normalize 直接保留 preview uid | uid/trim 与终稿不一致 |

---

## 4. 文件级改动清单

### 4.1 必改（Phase 1）

| 文件 | 改动性质 | 最大行数预算 |
|------|----------|--------------|
| `services/asr/rushi_asr/transcribe_job.py` | 新增 | ~200 |
| `services/asr/rushi_asr/app.py` | +3 routes | ~40 |
| `services/asr/rushi_asr/transcribe_windows.py` | callback | ~30 |
| `run_transcribe_cmd.rs` | 分支 + poll | ~120 |
| `transcribe_job.rs` | 新增 parse | ~150 |
| `useTranscribeJobController.ts` | preview 状态机 | +80（守卫关注） |
| `transcribePreviewState.ts` | 新增纯函数 | ~80 |
| `ProjectStatusFeedback.tsx` | progress props | ~25 |

### 4.2 显式不改

| 文件 | 原因 |
|------|------|
| `segment_cmd.rs` 核心 upsert 逻辑 | 终稿 save 语义不变 |
| `transcribe_native_online.rs` / `stt_native/*` | 在线路径 |
| `scripts/eval-run.py` | CI 基准 |
| `postprocess_cmd.rs` | L4 无关 |
| `useExportController.ts` 核心 | busy 已够 |
| `funasr_engine.py` generate 参数 | 无 ASR 算法变更 |

### 4.3 可选触达（Phase 2）

| 文件 | 条件 |
|------|------|
| `EditorToolbar.tsx` | 停止转写按钮 |
| `projectApi.ts` | `projectTranscribeAsyncStart` / `Finalize` + `loopbackFetch` 轮询 |
| `recording-transcribe-llm-pipeline.md` | 补「preview UI 态」脚注 |

---

## 5. 与相邻 Epic 的接口契约

| Epic | 关系 | R3e-C 承诺 |
|------|------|------------|
| **R3e-B** | 硬依赖 | 不 fork 第二套窗合并；只在窗末 emit delta |
| **R3t-B/L3** | 终稿一致 | done 仍 `source=asr_batch` 语义（detail/kind 同现路径） |
| **R3t-C/D/E** | 下游 | preview 段 **不可** 作为 LLM 输入；`transcribePreviewActive` export 给 auto-punctuate |
| **R3e-C→LLM 管道**（未来） | 不在本切片 | 不预留 partial DB；未来单独立项 |
| **STREAM-*** | 不复用 | Job API 不保证 mic 语义 |
| **ACC-EVAL-1** | 无交 | eval 仍 blocking |
| **R8 协作** | 无交 | — |

---

## 6. 能力—UI 状态矩阵（扩展）

| UI | 维度 | preview 期间 | done 后 |
|----|------|--------------|---------|
| 拉取语段 | D1+D5 | 同 preflight；busy 禁重复点 | 恢复 |
| 自动标点 | L4 + busy | **disabled** +「转写预览中」 | 同现 |
| 保存 | dirty | **disabled**（busy） | 可 save |
| 切项目/文件 | closeGate | **应 block**（busy 或 confirm） | 正常 |
| 导出 | busy | disabled | 正常 |
| 语段右键 merge/split | busy | disabled（现逻辑） | 正常 |
| 环境面板「可直接转写」 | D5 | 侧车占用时不重复开 Job | 正常 |

**手测矛盾场景（审查补充）**

4. **prepare-model 与 transcribe 并行**：转写中启动模型下载 — 允许但侧车 CPU 争用；不 crash。  
5. **终稿到达时用户正在看列表中部**：replace segments 后 scroll 不 jump 至 0（或可接受 — acceptance 定一条）。  
6. **preview 段数 >> 终稿段数**（dominant filter）：toast 提示段数变化原因。

---

## 7. 测试与回归清单

| 类别 | 命令 / 场景 |
|------|-------------|
| Python 新增 | `pytest services/asr/tests/test_transcribe_job.py` |
| Python 回归 | `test_transcribe_windows.py`、`test_transcribe.py` |
| Rust 新增 | `cargo test transcribe_job` |
| Rust 回归 | `transcribe_timeout`、`local_transcribe_gate` |
| TS 新增 | `transcribePreviewState.test.ts`、`useTranscribeJobController` 扩展 |
| TS 回归 | `ProjectStatusFeedback.test.ts` |
| 守卫 | `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` |
| 手测 | 50min 首段可见；cancel；blocking vs async final diff |
| CI | `eval-run.py` 仍绿（blocking） |

---

## 8. 回滚策略

| 层级 | 回滚 |
|------|------|
| 桌面 | feature：本机长音频仍可调 blocking（env 或 duration 未达阈值） |
| 侧车 | async 路由可 501；桌面 fallback sync |
| 数据 | 无 schema 变更；无 partial DB |

---

## 9. 审查结论

| 项 | 结论 |
|----|------|
| **范围可控** | 新增侧车 Job + 单 controller 状态机；不动 online/eval/LLM |
| **最大风险** | preview/终稿 diff、dirty 误判、双路径 parity |
| **建议 Phase 1 入口** | 侧车 `test_transcribe_job.py` + `transcribePreviewState.ts` 先行，再 Rust poll，最后 UI |
| **编码门禁** | research ✅ + impact ✅ + acceptance 手测 3 场景 |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 初版：全链路影响矩阵与禁止序列 |
