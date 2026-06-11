# 调研：R3h-I1 — Runtime Supervisor FSM

> **状态**：已采纳（2026-06-11）  
> **Plan**：[r3h-i1-runtime-supervisor-fsm-plan.md](./r3h-i1-runtime-supervisor-fsm-plan.md)  
> **Acceptance**：[r3h-i1-runtime-supervisor-fsm-acceptance.md](./r3h-i1-runtime-supervisor-fsm-acceptance.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.5.2 · §10 Step 1  
> **下游**：**ASR-WARM**（R3h-I4）须消费本 FSM，禁止双轨进程管理

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 安装包用户零终端启动侧车；模型切换后须可靠重启；诊断包须解释「谁在管 8741」 |
| **本仓现状** | 启动/重启逻辑散在 `asr_sidecar/bundled/lifecycle.rs`、`process.rs`；状态隐式：`AsrSidecarState(Option<Child>)` + `BundledAsrLaunchReport`；两把互斥锁 `ASR_LIFECYCLE` / `BUNDLED_LAUNCH`；**无** 会话级 `runtime_session_id`；**无** 显式 watchdog |
| **痛点** | stale 侧车、foreign 占端口、healthy skip 与 force_restart 路径难回归；ASR-WARM 若另起一套保活会与现有 kill/spawn 竞态 |
| **成功标准（设计冻结）** | 单一 FSM 表 + 身份字段 + 事件命名；与现有行为 **等价映射**；编码落位明确；ASR-WARM 可挂接 |

---

## 2. 业内对照（≥2）

| # | 路线 | 代表 | 机制 | 与 Rushi |
|---|------|------|------|----------|
| **A** | **桌面内嵌 Supervisor FSM** | VS Code extension host、Electron utilityProcess | 父进程 spawn + 状态机 + health probe | **选定** — 已部分实现，需显式化 |
| **B** | **systemd / launchd 常驻** | Linux 服务 | OS 级守护 | **不做** — v1 无 UI 不跑系统服务（ASR-WARM acceptance） |
| **C** | **纯 HTTP 无子进程管理** | 外置 Docker ASR | 用户自管 | **仅 dev** — `RUSHI_SKIP_BUNDLED_ASR=1` |

---

## 3. 现状代码映射（真源）

| 行为 | 当前落位 | 隐式状态 |
|------|----------|----------|
| 应用 setup 异步启动 | `lib.rs` → `try_start_bundled` | → `try_start_bundled_inner` |
| 端口/health 探测 | `probe.rs`：`AsrPortStatus`、`bundled_health_looks_like_rushi_asr` | Free / RushiAsr / Foreign |
| stale 构建检测 | `bundled_sidecar_is_fresh_build()` | catalog + punc + async API |
| spawn + health 轮询 | `process.rs`：`spawn_sidecar`、`wait_health_store_child` | Warming → Ready / fail |
| 杀子进程 + 清 token | `lifecycle.rs`：`stop_bundled` | Stopping |
| 杀 8741 监听者 | `bundled/port.rs` | Stopping |
| force restart | `force_restart_bundled_inner` | Stopping → Spawning |
| 候选 exe 顺序 | `candidates.rs`：bundle resources + **LRC** `resolve_installed_executable` | 多源 |
| dev 源码侧车 | `source.rs`：`restart_source_asr_sidecar` | Unmanaged（壳不 spawn bundle） |
| UI/诊断投影 | `BundledAsrLaunchReport`、`asr_setup_diagnose` | 仅 launch 成败，**无** phase |

**互斥**：

- `with_bundled_launch`：整段 start/restart（含最长 ~45s health wait）
- `with_asr_lifecycle`：短临界区 stop/kill

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **FSM 落位** | 新模块 `asr_sidecar/supervisor.rs`（类型 + 转换表）；`lifecycle.rs` 逐步委托（**I1 仅设计**；编码跟 ASR-WARM 或独立 I1 编码薄片） |
| **真源** | **SupervisorSnapshot** 为唯一相位真源；`BundledAsrLaunchReport` 降为 **投影**（向后兼容） |
| **runtime identity** | 每应用会话 `runtime_session_id`（UUID）；`launch_generation`；`executable_source` 枚举 |
| **watchdog** | I1 定义事件与周期探测契约；**空闲回收 / 预热** 参数留给 **ASR-WARM** |
| **LRC vs bundled** | 统一为 `ExecutableSource::BundledMedia` \| `LrcInstalled` \| `DevSource` \| `ExternalListener` |
| **不做什么** | 不引入 xstate；不改 `/health` 契约；不在 I1 改默认启动时序 |

---

## 5. 签收

- [x] 调研 brief（2026-06-11）
- [ ] plan FSM 表评审（见 acceptance）
- [ ] 设计冻结 → 路线图 I1 ✅、可开 ASR-WARM 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：代码对照 + 决策 |
