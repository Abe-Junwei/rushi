# Acceptance: R3h-I1 — Runtime Supervisor FSM（设计冻结）

> **Research** · **Plan**：同目录 `*-research.md` / `*-plan.md`  
> **路线图**：§10 Step 1 · remediation §4.1.5.2  
> **解锁**：**ASR-WARM**（R3h-I4）编码

## 目标

**显式 FSM 设计冻结**：状态、事件、身份字段、转换表与现 `asr_sidecar` 行为对齐；实施前 **无** 运行时行为变更。

---

## 设计冻结闸门（全部勾选 = Step 1 ✅）

| ID | 项 | 证据 |
|----|-----|------|
| **D1** | Plan §2 九态覆盖 idle→stopped | [plan §2](./r3h-i1-runtime-supervisor-fsm-plan.md) |
| **D2** | Plan §3 事件表覆盖 setup/restart/stale/foreign/token | plan §3 |
| **D3** | Plan §4 转换表与 `try_start_bundled_inner` 分支一一对照 | research §3 + plan §4.1 |
| **D4** | `SupervisorSnapshot` 含 `runtimeSessionId` + `launchGeneration` | plan §5 |
| **D5** | `executable_source` 含 bundled + LRC + dev + external | plan §5 |
| **D6** | `BundledAsrLaunchReport` 降级为投影（向后兼容） | plan §5 投影 |
| **D7** | Watchdog 仅定义契约；预热/空闲参数归 ASR-WARM | plan §6 |
| **D8** | 编码落位 `asr_sidecar/supervisor.rs`（非第二套 spawn） | plan §7 |
| **D9** | ASR-WARM 禁止双轨进程管理（引用 plan §6 硬规则） | [asr-warm-acceptance.md](./asr-warm-acceptance.md) §范围 |

---

## 手测（设计阶段：代码走读）

| # | 场景 | 现行为 | FSM 映射 |
|---|------|--------|----------|
| 1 | 安装包冷启动，8741 空闲 | spawn → health ok | idle→probing→spawning→warming→ready |
| 2 | 二次启动，8741 已 healthy fresh | skip spawn | probing→ready（adopt） |
| 3 | 旧侧车无 model_catalog | kill + respawn | probing→stopping→spawning→… |
| 4 | 8741 被 foreign 占用 | kill listeners + spawn | probing→stopping→spawning→… |
| 5 | `desktop:dev` + `RUSHI_SKIP_BUNDLED_ASR=1` | 不 spawn bundle | unmanaged |
| 6 | 环境页「应用模型」force restart | stop + kill + spawn | ready→stopping→spawning→… |

走读落位：`bundled/lifecycle.rs`、`process.rs`、`candidates.rs`、`lib.rs` setup。

---

## 编码阶段验收（I1a — 与 ASR-WARM 同批 · 2026-06-11）

- [x] `cargo test` supervisor 转换 golden（含 idle_stopped 投影）
- [x] `asr_setup_diagnose` 含 `supervisor` 块
- [x] 诊断 zip 含 `runtimeSessionId`（`asr-setup.txt`；dev 代验见 [asr-warm-handtest](./asr-warm-handtest-signoff-2026-06-11.md) §3）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

---

## 结论分支

| 结果 | 动作 |
|------|------|
| **设计 Go** | 路线图 Step 1 ✅；开 **ASR-WARM** 编码 |
| **Defer** | 修订 plan §4/§5 后再冻 |

---

## 签收

| 项 | 状态 |
|----|------|
| D1–D9 | ☑ 设计评审通过（2026-06-11） |
| 手测走读 #1–#6 | ☑ 与 plan 一致 |

**签收人**：产品/单人维护者 **日期**：2026-06-11
