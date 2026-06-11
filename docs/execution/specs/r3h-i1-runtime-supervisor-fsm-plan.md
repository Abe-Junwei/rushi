# Plan: R3h-I1 — Runtime Supervisor FSM（设计冻结）

> **Research**：[r3h-i1-runtime-supervisor-fsm-research.md](./r3h-i1-runtime-supervisor-fsm-research.md)  
> **Acceptance**：[r3h-i1-runtime-supervisor-fsm-acceptance.md](./r3h-i1-runtime-supervisor-fsm-acceptance.md)  
> **状态**：**设计冻结**（2026-06-11）— **本 plan 不含业务编码**；实现见 §7 分期  
> **下游**：[asr-warm-acceptance.md](./asr-warm-acceptance.md)（R3h-I4）

---

## 1. 目标

将 8741 侧车 **启动 / 探测 / 停止 / 重启** 收成 **单一显式 FSM**，提供 **runtime identity** 供诊断与 ASR-WARM 消费；统一 **bundled 安装介质** 与 **LRC app_data 安装** 真相。

---

## 2. 状态（SupervisorPhase）

| Phase | 含义 | 用户可观察 |
|-------|------|------------|
| **`idle`** | 壳已初始化，尚未执行 start 动作 | 启动瞬间 |
| **`unmanaged`** | 壳不管理子进程（`RUSHI_SKIP_BUNDLED_ASR=1` 或无候选 exe） | dev / 外置 ASR |
| **`probing`** | 检查 :8741 TCP + `/health` + root catalog | 诊断「探测中」 |
| **`stopping`** | 杀 managed child + 可选 kill listeners | 模型切换 / restart 前半 |
| **`spawning`** | 按候选列表 `Command::spawn` | 日志 `bundled_sidecar_spawn` |
| **`warming`** | 子进程已存于 `AsrSidecarState`，轮询 health（≤45s） | 首次转写前等待 |
| **`ready`** | rushi-asr health ok + fresh build + token 一致 | 环境页可转写 |
| **`degraded`** | 启动失败 / foreign 端口 / stale build / health 超时 | `bundled_launch.success=false` |
| **`stopped`** | 应用退出或显式 `stop_bundled` 完成 | 无子进程 |

**不变量**

1. `ready` ⇒ `bundled_health_looks_like_rushi_asr()` && `bundled_sidecar_is_fresh_build()`（与现逻辑一致）。  
2. `warming` ⇒ `AsrSidecarState` 有 `Child` 且 `child.try_wait() == Ok(None)`。  
3. `unmanaged` ⇒ 壳 **不** 写入 `AsrSidecarState`（dev 由用户自启 venv）。  
4. 同一时刻仅一个 `with_bundled_launch` 持有者（保留现有 mutex，FSM 不替代锁）。

---

## 3. 事件（SupervisorEvent）

| 事件 | 触发源 | 说明 |
|------|--------|------|
| `AppSetup` | `lib.rs` setup | 调度 `TryStartBundled` |
| `TryStartBundled` | setup / 用户「重试」 | 进入 probing 链 |
| `ForceRestart` | `force_restart_bundled`、模型 pref 应用 | stopping → spawning |
| `StopBundled` | `stop_bundled`、应用 teardown | → stopped |
| `PortFree` | `probe_asr_port` | 可 spawn |
| `PortRushiHealthy` | health + fresh | 可 ** adopt ** skip spawn |
| `PortRushiStale` | health ok 但 !fresh | stopping |
| `PortForeign` | TCP 有连接但非 rushi-asr | degraded 或 kill→spawn |
| `SpawnOk` | `spawn_sidecar` | → warming |
| `SpawnFail` | 候选列表穷尽 | → degraded |
| `HealthOk` | `wait_health_store_child` 成功 | → ready |
| `HealthTimeout` | 45s 轮询失败 | → degraded |
| `ChildExited` | `try_wait` Some | → probing 或 degraded |
| `TokenMismatch` | dev token 不一致 | skip adopt（现 `WARN bundled_sidecar_token_mismatch_dev`） |
| `AppExit` | 壳销毁 | → stopped |

---

## 4. 转换表（核心路径）

```text
                    AppSetup / TryStartBundled
 idle ─────────────────────────────────────────► probing
 unmanaged ◄── RUSHI_SKIP_BUNDLED_ASR / no candidates

 probing ── PortRushiHealthy + fresh + token ok ──► ready (adopt skip)
 probing ── PortRushiStale ──► stopping ──► spawning
 probing ── PortForeign (busy) ──► stopping ──► spawning
 probing ── PortFree ──► spawning

 spawning ── SpawnOk ──► warming
 spawning ── SpawnFail (all candidates) ──► degraded

 warming ── HealthOk ──► ready
 warming ── HealthTimeout / ChildExited ──► degraded

 ready ── ForceRestart ──► stopping ──► spawning
 ready ── ChildExited (watchdog) ──► probing | degraded
 ready ── StopBundled / AppExit ──► stopped

 degraded ── TryStartBundled / ForceRestart ──► probing
```

### 4.1 与现 `try_start_bundled_inner` 对齐

| 现分支 | FSM 路径 |
|--------|----------|
| skip env | `unmanaged` |
| `bundled_health_looks_like_rushi_asr` + fresh + token ok → return | `probing` → `ready`（adopt） |
| stale → stop + kill listeners | `probing` → `stopping` → `spawning` |
| port busy not rushi → kill | `probing` → `stopping` → … |
| candidate loop + `wait_health_store_child` | `spawning` → `warming` → `ready`/`degraded` |

---

## 5. Runtime Identity（SupervisorSnapshot）

诊断 / ASR-WARM / 导出 zip **统一字段**（JSON camelCase）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `runtimeSessionId` | string (UUID) | **应用进程生命周期** 内不变；壳 setup 时生成 |
| `launchGeneration` | u64 | 每次 `ForceRestart` +1 |
| `phase` | SupervisorPhase | §2 枚举 snake_case |
| `executableSource` | enum | `bundled_media` \| `lrc_installed` \| `dev_source` \| `external_listener` \| `none` |
| `managedChildPid` | option u32 | 壳 spawn 的子进程；adopt 时为 `none` |
| `loopbackPort` | u16 | 固定 8741 |
| `portStatus` | AsrPortStatus | 复用 `probe.rs` |
| `healthFresh` | bool | `bundled_sidecar_is_fresh_build()` |
| `localTokenManaged` | bool | 壳是否持有 `RUSHI_LOCAL_TOKEN` |
| `lastTransitionMs` | u64 | epoch ms |
| `lastErrorCode` | option string | 如 `health_timeout`、`foreign_port`、`spawn_failed` |
| `activeExecutable` | option string | 末次成功 spawn 路径（脱敏为文件名即可） |

**投影（兼容）**：

```text
BundledAsrLaunchReport.attempted  ← phase ∈ {spawning, warming, degraded} 且本轮尝试过
BundledAsrLaunchReport.success    ← phase == ready
BundledAsrLaunchReport.detail     ← lastErrorCode 用户文案映射
```

---

## 6. Watchdog 契约（实现留给 I1 编码 + ASR-WARM）

| 职责 | I1 设计 | ASR-WARM 实现参数 |
|------|---------|-------------------|
| 子进程 reap | `ChildExited` 事件；`reap_bundled_sidecar_if_exited` 并入 supervisor tick | — |
| 周期 health | `ready` 下每 N 秒 `probe`（默认 **不** 在 I1 启用，避免行为变更） | N=30s；失败 → `degraded` |
| 空闲回收 | 事件 `IdleTimeout` 定义；**不** 在 I1 设默认值 | T=15min（acceptance 手测定） |
| 预热 | 事件 `WarmupRequested`；**不** 在 I1 调用 | 首次转写前 / health ok 后 |

**硬规则**：ASR-WARM **不得** 绕过 supervisor 直接 `Command::spawn` / `kill`。

---

## 7. 编码落位（冻结后实施顺序）

### Phase I1a（建议与 ASR-WARM 第一轮合并，≤1w）

| 操作 | 路径 |
|------|------|
| 新建 | `asr_sidecar/supervisor.rs` — `SupervisorPhase`、`SupervisorSnapshot`、`transition()` |
| 新建 | `AsrSupervisorState` — `Mutex<SupervisorSnapshot>` 注册于 `lib.rs` |
| 改 | `bundled/lifecycle.rs` — 每步 `emit(event)` + 更新 snapshot |
| 改 | `asr_setup/diagnose.rs` — 输出 `supervisor` 块 |
| 改 | `diagnostic.rs` — zip 含 `runtimeSessionId` |
| 测 | `asr_sidecar/supervisor.rs` `#[cfg(test)]` — 转换表 golden |

### Phase I1b（可选薄片）

- `tauri::command` `asr_supervisor_snapshot` 供环境页只读展示  
- 架构守卫：禁止 `lib.rs` 外直接 `Command::spawn` 侧车 exe（allowlist `process.rs`）

**本步（设计冻结）交付**：§2–§6 表 + 验收勾选；**无** 上述编码。

---

## 8. 能力—UI 状态矩阵（实现时必填）

| UI / 诊断 | 维度 | 真源 | 禁止 |
|-----------|------|------|------|
| 环境页「侧车未启动」 | Supervisor `phase` + `portStatus` | `asr_supervisor_snapshot` 或 diagnose | 仅读 `bundled_launch` 布尔 |
| 一键准备「重启侧车」 | `launchGeneration` 变化 | ForceRestart 后 diagnose 刷新 | 绕过 supervisor 直 kill |
| 导出诊断包 | `runtimeSessionId` | diagnostic zip | — |

---

## 9. 验证（设计冻结）

- [x] FSM 状态/事件/转换表覆盖现 `lifecycle.rs` 全分支  
- [x] LRC `resolve_installed_executable` 归入 `executable_source=lrc_installed`  
- [x] ASR-WARM acceptance §5 可引用 `phase`  
- [ ] acceptance 人工勾选 → 路线图 Step 1 ✅

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 设计冻结 v1 |
