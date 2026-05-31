# Acceptance: R3e-C — 转写增量出段

> **状态**：🟡 **编码✅**（Phase 1–2：async Job、preview merge、停止转写、preview 门禁、DEV SLA log；controller 已拆）；**手测⏳** — [`r3e-c-incremental-transcribe-hand-test-checklist.md`](./r3e-c-incremental-transcribe-hand-test-checklist.md)  
> **Plan**：[`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md)  
> **Research / Impact**：[`r3e-c-incremental-transcribe-research.md`](./r3e-c-incremental-transcribe-research.md)、[`r3e-c-incremental-transcribe-impact.md`](./r3e-c-incremental-transcribe-impact.md)

## 总闸门

- [x] blocking `/v1/transcribe` 回归仍绿
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [x] 动 Rust 时 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`（transcribe_job 相关）

## 自动

- [x] `test_transcribe_job.py`：3 窗 delta 时间单调、offset 正确、cancel 后 phase=cancelled
- [x] TS `mergeTranscribeSegmentsDelta` / preview 禁 save 单测（通过 `npm run test`）
- [x] 同一 fixture blocking vs async final segments 结构测试（侧车）：197 segments，首/末段一致

## 手测

- [x] **首段可见**：**~20min** 中文音频（制控.mp3，1249s），async **120s 窗**；首窗结束后 **~23.9s** 内出现 35 条非空语段
- [x] **进度**：status API 返回 `window_index/window_count` 从 0/11 递增至 11/11
- [ ] **预览只读**：转写中改字无效；LLM 自动标点 disabled + reason（桌面 UI 手测待补）
- [x] **终稿**：async final segments（197）与 blocking（197）一致；首段/末段 byte-equal
- [x] **取消**：POST /v1/transcribe/cancel 返回 `{"cancelled":true}`；最终 phase=`cancelled`（cooperative cancel，当前窗完成后停止）
- [ ] **失败**：杀侧车或窗失败 → 错误文案；无部分 persist（侧车 smoke 未覆盖 kill 场景）

## 能力—UI 矩阵

见 plan §9；手测场景 1～3 必跑。

## 非目标签收

- [ ] 未引入 partial SQLite
- [ ] 未在 R3e-C PR 内接 LLM 窗间链

---

**下一轮**：R3t-D 或 STREAM 调研（与 R3e-C 无硬依赖）
