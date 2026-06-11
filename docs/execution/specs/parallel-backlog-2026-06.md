# 并行薄片索引（不挡 v1 后主序 · 2026-06-11 刷新）

> **主序真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10  
> **纪律**：每轮仍 **一轮一薄片**；下列项 **勿与 ⑤″f-B 或 LLM Gate 填表同 PR 大改**

## 当前主序（2026-06-11）

```text
Step 1  R3h-I1   Supervisor FSM 设计冻结     ✅ 2026-06-11
Step 2  ASR-WARM 侧车保活 + 预热             ✅ dev 签收 2026-06-11
Step 3  R3h-I1   I1a 编码签收 + commit       ← 当前
```

| 步 | 项 | 状态 | 说明 |
|----|-----|------|------|
| **1** | **R3h-I1** | ✅ 设计冻结 | [plan](./r3h-i1-runtime-supervisor-fsm-plan.md) · [acceptance](./r3h-i1-runtime-supervisor-fsm-acceptance.md) |
| **2** | **ASR-WARM** | ✅ dev 签收 | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) · [handtest](./asr-warm-handtest-signoff-2026-06-11.md) |
| **3** | **R3h-I1 I1a** | 🟡 编码待签 | 与 Step 2 同批实现；勾选 acceptance §编码阶段 |
| — | **TRN-DIAG** | ✅ | 已闭合 |
| — | **R3h-2** | ✅ | 续传 / GC / C 类回滚 |
| — | **Gate-B / 4b** | ❌ No-Go | [`llm-loc-gate-b-decision-2026-06.md`](./llm-loc-gate-b-decision-2026-06.md) |
| — | **R3s-A** | 📋 Defer | Qwen3 战略预留；[plan §Defer](./r3s-sherpa-qwen3-default-engine-plan.md) |

## 并行候选（路线图 §10 · 不挡 Spike/4a）

| ID | 主题 | 预估 | 状态 | 规格 / 验收 | 启动条件 |
|----|------|------|------|-------------|----------|
| **R3h-0** | 构建 smoke + Win 磁盘 + pip UI 降级 | 2–3d | ✅ **mac** | [r3h-0 acceptance](./r3h-0-asr-sidecar-build-smoke-acceptance.md) · [signoff](./r3h-0-phase-signoff-2026-06.md) | mac ✅ 2026-06-08；Win §4 有 Win 机时补 |
| **TRN-DIAG** | 转写阶段时间线 + 诊断包 | 0.5w | ✅ | [`trn-diag-acceptance.md`](./trn-diag-acceptance.md) | R3t-B ✅ 后；与 ⑤″f 不同目录 |
| **ASR-WARM** | 侧车保活、模型预热 | 0.5–1w | ✅ dev | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) | release idle 补测可选 |
| **R3h-1-R** | Runtime manifest **发行激活** | 3–5d | ✅ R1+R2 签收 | [signoff](./r3h-1-r-phase-signoff-2026-06.md) · [plan](./r3h-1-r-runtime-manifest-release-activation-plan.md) | **R3h-1** ✅ |
| **R3h-2** | 断点续传、GC、C 类升级回滚 | ~1w | ✅ | [`r3h-2 acceptance`](./r3h-2-local-runtime-resume-acceptance.md) · remediation §5 Phase 2 | 续传手测 ✅ · C 类集成测 ✅ |
| **R3h-3.5** | Sherpa **Paraformer** Spike | ~1w | ✅ Partial Go | [`r3h-3.5-sherpa-spike-acceptance.md`](./r3h-3.5-sherpa-spike-acceptance.md) · ADR-0006 | R3h-3 ✅ |
| **R3f Win** | 安装包零终端手测 | 2–3d | ⏳ | [r3f signoff](./r3f-phase-signoff-2026-06.md) | 有 Win 机 |
| **R3t-E** | 词表校对手测 | — | 🟡 编码✅ | r3t-e 清单 | 穿插轮 |
| **⑤″f F2/F1/F6** | 查找替换 / 规则 / 记忆 | — | 🟡 | [r3t-f plan](./r3t-f-post-transcribe-suite-plan.md) | 穿插轮 |

## 禁忌（§4.1.3）

- **勿** R3f 大改与 R3e-B 分片同轮  
- **勿** Gate-B 未过即改 `llm-runtime` catalog  
- **勿** ⑤″f-A 手测未签即开 MEM-P0 编码（路线图：⑤″f-B 在 A 闭合后）

## 推荐空档顺序（单人）

```text
1. ~~R3h-I1 FSM 设计冻结~~ ✅
2. ~~ASR-WARM 编码 + 手测~~ ✅
3. R3h-I1 I1a 编码签收 + git commit（**主刀**）
4. 穿插：⑤″f F8/F4 尾项 · R3f Win（有 Win 机）
5. 背景：R3s-A Phase 0 金标（Defer，不编码）
```

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对齐路线图 §10 并行表 + Gate-B No-Go |
| 2026-06-04 | F7 双机手测暂缓；下一刀改为 ⑤″f-D / MEM-P2 / R3h-0 |
| 2026-06-06 | R3h-0 mac 机器闸门 ✅；验收三件套 + `scripts/r3h-0-machine-gate.sh` |
| 2026-06-08 | **R3h-0 mac 签收**；Win §4 豁免；下一刀 → R3f 手测 / Project Hub |
| 2026-06-10 | **R3h-1-R** ✅；**R3h-2** ✅ |
| 2026-06-11 | §10 对齐：**I1 设计 → ASR-WARM**；R3s-A Defer；TRN-DIAG ✅ |
| 2026-06-11 | **R3h-I1** 设计冻结三件套；主刀 → ASR-WARM |
