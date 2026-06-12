# 调研：STT-CANCEL（Q-STT-CANCEL-1）— 在线 STT 真 Abort

> **状态**：已采纳（Step 7a 编码）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.7 Q-STT-CANCEL-1 · §10.4 Step 7a–e
> **关联 spec**：`online-stt-cancel-v1.1-{intent,plan,acceptance}.md`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 在线 STT 转写长音频时用户点「停止」；v1 前端用 `online-stt-*` 假 job id，`cancelTranscribe` 不调用后端，仅等 `project_run_transcribe` 返回后丢弃结果 |
| 本仓现状 | 本机侧车 async 已有 `postTranscribeCancel` + `/v1/transcribe/cancel` ✅；在线路径 `project_run_transcribe` 无 `request_id`、无 `AbortHandle`；后处理已有 `PostprocessCancelState` + `Abortable` 模式 |
| 成功标准 | 在线转写中停止 ≤2s 恢复语段；timeline `outcome=cancelled`；本机 async 回归不退化 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | **AbortHandle + 统一 cancel command（采纳）** | 本仓 `PostprocessCancelState` | `request_id` → `AbortHandle`；`Abortable::new(future, registration)`；`postprocess_cancel_*` 按 id abort |
| B | **HTTP 层 AbortSignal** | fetch / reqwest cancel | 需各 adapter 持 `Client` + 可取消 request；poll 环需检查 flag |
| C | **丢弃结果（v1）** | 当前 `online-stt-*` | 不 abort 网络；invoke 完成后前端 throw |

---

## 3. 决策

| 问题 | 结论 |
|------|------|
| 选定方案 | **7a**：复用 Postprocess 模式 — `TranscribeCancelState` + `project_cancel_transcribe` + `project_run_transcribe(request_id)` + 在线分支 `Abortable` 包装。**7b–d**：各 native adapter HTTP/poll 可中断。**7e**：generic multipart 尽力取消 |
| 不做什么 | 不改本机侧车 cancel；不扩 `async_start` 不可中断窗口 |
| 本仓复用 | `postprocess_cancel_cmd.rs`、`postprocess_auto_punctuate_cmd.rs` Abortable 模式 |

---

## 4. 落位预告

| 层 | 路径 |
|----|------|
| Rust | `transcribe_cancel_cmd.rs`；`run_transcribe_cmd.rs`；`transcribe_timeline.rs` `finish_cancelled` |
| TS | `projectApi.ts`；`useTranscribeJobController.ts`；`transcribePreviewState.ts` |
| 权限 | `permissions/project.toml` |

**变更记录**：2026-06-12 初版
