# Acceptance: R3e-C — 转写增量出段

> **状态**：✅ **2026-05-31 签收**（Phase 1–2 + 手测 — [`r3e-c-incremental-transcribe-hand-test-checklist.md`](./r3e-c-incremental-transcribe-hand-test-checklist.md)）  
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

- [x] **首段可见**：制控.mp3（1249s），async **120s 窗**；首窗结束后 **~23.9s** 内出现非空语段
- [x] **进度**：status API `window_index/window_count` 0/11 → 11/11
- [x] **预览只读**：转写中改字无效；自动标点 disabled + reason
- [x] **终稿**：async final（197）与 blocking（197）一致；首段/末段 byte-equal
- [x] **取消**：`POST /v1/transcribe/cancel` → `cancelled:true`；phase=`cancelled`
- [x] **失败**：cooperative cancel 已验；侧车 kill mid-job 归入 **R9 发行 smoke**（非 R3e-C 阻塞项）

## 能力—UI 矩阵

- [x] plan §9 场景 1～3（见 checklist）

## 非目标签收

- [x] 未引入 partial SQLite
- [x] 未在 R3e-C PR 内接 LLM 窗间链

---

**下一轮**：**R3g-C**（§4.1.1 **⑤g**）→ ACC-STT-UNIFY → R3t-D
