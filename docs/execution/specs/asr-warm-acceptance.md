# Acceptance: ASR-WARM — 侧车保活与预热（R3h-I4）

> **状态**：✅ **通过**（dev 手测 2026-06-11）· release idle 补测可选  
> **手测记录**：[`asr-warm-handtest-signoff-2026-06-11.md`](./asr-warm-handtest-signoff-2026-06-11.md)  
> **排期**：路线图 §4.1.1 **⑦½**（R3h-2 之后）  
> **Backlog**：[`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.1  
> **启动条件**：§4.1.5 — **R3t-B 编码完成** ✅ + **R3h-I1 Supervisor FSM 设计冻结** ✅（[plan](./r3h-i1-runtime-supervisor-fsm-plan.md) 2026-06-11）

## 目标

同一应用会话内，**连续两次转写**第二次无明显冷启动劣化（侧车进程与模型已预热）。

## 范围

### 做

| # | 交付 |
|---|------|
| 1 | 会话内侧车 **保活**（HTTP keep-alive 或常驻子进程，实施时二选一并 ADR 一行记录） |
| 2 | 首次 health / 首次转写前 **模型预热**（可配置开关，默认开） |
| 3 | 空闲 **回收策略**（超时关闭或降载，避免长期占 RAM） |
| 4 | 诊断含 `runtime_session_id`（或等价）便于对照两次转写 |
| 5 | 与 **R3h-I1** Supervisor 状态一致（勿双轨进程管理） |

### 不做

- 多机 GPU 池
- 后台常驻系统服务（无 UI 时仍跑）

## 验收标准

- [x] 同一项目、同一模型：**连续 2 次**转写，第二次相对第一次**无明显冷启动劣化**（启动预热后两次耗时接近亦可；手测见 signoff §1）
- [x] 应用退出后：无 `rushi-desktop` / bundled `rushi-asr-sidecar` 僵尸（dev 已测；见 signoff §4）
- [ ] 空闲超时回收 managed 侧车（**release + `RUSHI_ASR_IDLE_STOP_SEC`** 补测；dev `SKIP_BUNDLED` 不适用）
- [x] focused test / 单元：`supervisor` + `warm::tests` + 全量 `npm run test`（见 signoff §5）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 手测场景

1. 冷启动应用 → 确认 `desktop.log` 有 `asr_warmup_ok` → 同项目连续 2 次转写记时  
2. **判据**：两次接近为通过；对照组 `RUSHI_ASR_WARMUP=0` 或冷侧车应可见首次更慢（约 3–5s 级，随语段时长摊薄）

## 调研输入（编码前可选）

- FastAPI/Uvicorn keep-alive、SIGTERM 优雅退出、预热触发点（health vs 后台线程）— 见路线图审查「调研 3」

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `asr_sidecar/supervisor.rs`、`asr_sidecar/warm.rs`、`bundled/lifecycle.rs` |
| Python | `services/asr/rushi_asr/app.py`（`/v1/models/warmup` 已有） |
