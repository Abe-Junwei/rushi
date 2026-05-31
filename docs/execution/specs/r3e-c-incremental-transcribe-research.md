# 调研：R3e-C — 转写增量出段（Job + 预览）

> **状态**：已采纳（2026-05-30）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §R3e  
> **关联 spec**：[`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md)、[`r3e-c-incremental-transcribe-impact.md`](./r3e-c-incremental-transcribe-impact.md)  
> **门禁**：编码前须链接本文 + impact 文档

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 30～60min 本机 FunASR 转写；R3e-B 已分窗降 OOM，但 UI 仍 **blocking** 至整 Job 结束才刷新语段 |
| **本仓现状** | `project_run_transcribe` → 单次 `POST /v1/transcribe`；R3e-B 侧车内 `transcribe_window i/N` 仅日志；busy 文案「完整识别可能需数分钟」 |
| **成功标准** | 首窗结束后 **≤2min** 内 UI 可见 ≥1 条语段；终稿与 blocking **segments 一致**；失败/取消 **SQLite 不变** |

**关键路径（现状）**

```text
useTranscribeJobController.executeTranscribe
  → beginBusy("transcribe")
  → project_run_transcribe (Rust await 整 HTTP)
  → POST /v1/transcribe (侧车 blocking)
  → transcribe_by_windows 内循环（用户不可见）
  → parse → file_save_segments → openFileWrapped
  → endBusy
```

---

## 2. 业内成熟路线（≥4）

### A. 云异步 Job + 轮询 final（AssemblyAI / Rev 类）

| 项 | 内容 |
|----|------|
| **代表** | [AssemblyAI Transcript Status](https://www.assemblyai.com/docs/pre-recorded-audio/transcript-status)、Rev/Descript 后台转写 |
| **机制** | `POST /transcript` → `job_id` → 轮询 `status` 直至 `completed`；**completed 才返回全文/句段** |
| **增量** | 默认 **无** 中间 segments；进度仅 `processing/queued` |
| **与 Rushi** | **UX 参考**（Job + poll）；**不**抄「仅 status 无 preview」——我们有 R3e-B 窗级 ASR 结果可推送 |

### B. 侧车内长任务 + 状态端点（本仓 prepare-model）

| 项 | 内容 |
|----|------|
| **代表** | `POST /v1/models/prepare/async` + `GET /v1/models/prepare-status`；[`usePrepareModelController.ts`](../../../apps/desktop/src/pages/usePrepareModelController.ts) |
| **机制** | 后台线程 + 内存 tracker；桌面 **loopbackFetch 轮询** percent/phase |
| **与 Rushi** | **高复用**：同一 loopback 信任边界、poll 间隔、cancel AbortController 模式 |

### C. 云 batch + 内部分片合并（Whisper / FunASR 社区）

| 项 | 内容 |
|----|------|
| **代表** | faster-whisper 分块；FunASR 长音频 VAD/窗；R3e-B 已落地 |
| **机制** | 服务端循环 ASR → **内部** merge；客户端 historically **一次 JSON** |
| **与 Rushi** | **ASR 真源不变**；R3e-C 只把 **窗完成事件** 暴露给桌面，不改 merge 算法 |

### D. 流式 WebSocket partial（Otter live / AssemblyAI Streaming）

| 项 | 内容 |
|----|------|
| **代表** | AssemblyAI `wss://streaming`；会议实时字幕 |
| **机制** | 词/句级 partial → final 替换 |
| **与 Rushi** | **不采纳** v1；属 **STREAM-***；与文件 batch 编辑器真源冲突 |

### E. 仅进度条、不出段（Otter 导入 FAQ 类）

| 项 | 内容 |
|----|------|
| **代表** | 云上传后百分比进度，完成才出稿 |
| **机制** | Job percent，无 intermediate transcript |
| **与 Rushi** | R3e-B 已等效「仅 busy」；**不满足**「实时语段」产品目标 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 备注 |
|------|--------|----------|-------------------|------|
| **B prepare-status** | **高** | poll、c cancel、loopbackFetch | 无 | **首选模板** |
| **C R3e-B 窗循环** | **高** | `transcribe_windows.py`、offset merge | 无 | 加 progress callback |
| **A 云 Job poll** | 中 | phase 状态机命名 | 云 API 无 delta segments | 扩展 delta |
| **D 流式 WS** | 低 | — | partial 落库、双真源 | 延后 STREAM |
| **partial SQLite** | 低 | — | pipeline v1、correction_memory | **已否决**（见 plan §2） |

**本仓必须先复用**

| 模块 | 路径 |
|------|------|
| 窗 ASR | `transcribe_windows.py`、`generate_and_parse_funasr` |
| 段解析 | `transcribe_response.rs` / `parse_transcribe_segments_from_json` |
| 写库 | `file_save_segments_inner`（**仅 done 一次**） |
| 重载 | `closeGate.openFileWrapped` + `setSavedSnapshot` |
| Preflight | `local_transcribe_gate`、`computeLocalAsrTranscribeReady` |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | 侧车 **async Job** + `GET transcribe/status` 推送 **segments_delta**；桌面 **内存 preview**；**done 原子写库** |
| **poll vs SSE** | v1 **轮询** 500ms～1s；v1.1 可选 Tauri event |
| **blocking API** | **保留** `/v1/transcribe`（eval、CI、短路径、回归对照） |
| **在线 STT** | v1 **不改**；仍 blocking；UI 说明「增量仅本机长音频」 |
| **partial SQLite** | **不做** |
| **转写中 LLM** | **不做**；L4 仍 stable 后用户触发 |
| **与 ADR** | 不修改 L2–L3 真源定义；preview 为 **UI 态**，非 SQLite |

**风险与 spike**

| 风险 | spike / 缓解 |
|------|----------------|
| async final ≠ blocking | 手测 + 可选 contract test 同 wav |
| 8741 单进程 Job 并发 | v1 **单 Job**；新 async 拒绝第二个 job |
| controller 膨胀 | `transcribePreviewState.ts` 纯函数 + 守卫 hotspot |

---

## 5. 落位预告

见 [`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md) §6；影响面见 [`r3e-c-incremental-transcribe-impact.md`](./r3e-c-incremental-transcribe-impact.md)。

---

## 6. 签收

- [x] 调研 brief 完成
- [x] plan / intent / acceptance 已链接本文
- [ ] 用户确认可进入编码（待本审查交付后）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 初版：业内 Job/poll + prepare 模板 + 否决 partial DB |
