# Acceptance: ASR-WARM — 侧车保活与预热（R3h-I4）

> **状态**：📋 未编码  
> **排期**：路线图 §4.1.1 **⑦½**（R3h-2 之后）  
> **Backlog**：[`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.1  
> **启动条件**：§4.1.5 — **R3t-B 编码完成** + **R3h-I1 Supervisor FSM 设计冻结**

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

- [ ] 同一项目、同一模型：**连续 2 次**转写，第二次 wall time 明显短于第一次（手测记录两次秒数）
- [ ] 应用退出或空闲超时后：资源释放，无僵尸 `rushi-asr-sidecar`（活动监视器/任务管理器抽查）
- [ ] focused test：mock 下第二次请求不重复「冷启动路径」（契约级）
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 手测场景

1. 冷启动应用 → 第一次 13min 转写 → 记录总耗时  
2. 不杀应用 → 第二次同项目转写 → 总耗时显著下降  

## 调研输入（编码前可选）

- FastAPI/Uvicorn keep-alive、SIGTERM 优雅退出、预热触发点（health vs 后台线程）— 见路线图审查「调研 3」

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `asr_sidecar.rs` |
| Python | `services/asr/rushi_asr/app.py`（若需） |
