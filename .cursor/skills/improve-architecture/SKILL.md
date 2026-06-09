---
name: improve-architecture
description: >-
  Finds deepening opportunities in the Rushi codebase using module depth vocabulary,
  informed by CONTEXT.md and docs/adr. Use when the user wants architecture review,
  refactoring opportunities, hotspot remediation, or asks to improve codebase
  architecture.
disable-model-invocation: true
---

# Improve Architecture（Rushi）

目标：**deep modules**（小 interface、深 implementation）— 更可测、更易被 Agent 导航。

先读 [`CONTEXT.md`](../../../CONTEXT.md)、[`docs/agents/domain.md`](../../../docs/agents/domain.md)、相关 ADR。

## 词汇（全文见 LANGUAGE.md）

- **Module** — 有 interface + implementation 的单元（函数、类、hook、Rust mod）
- **Depth** — interface 背后承载的行为量；**shallow** = interface 几乎等于 implementation
- **Seam** — 可替换实现而不改调用方的地方
- **Deletion test** — 删掉该 module：复杂度消失（shallow）还是散到 N 个 caller（deep）？

## 与 Rushi 硬守卫配合

`node scripts/check-architecture-guard.mjs` 报 hotspot 时优先审查：

- `use*Controller.ts` > 300 行或 > 12 hooks
- `.rs` > 500 行
- Orchestrator 内成簇业务 callback

Jieyu 落位：`useXxxController.ts` / `services/` / 纯函数 — 见 `AGENTS.md`。

## 流程

### 1. Explore

用 Explore subagent 或定向 grep，找 friction：

- 理解一概念需跳转多少小文件？
- shallow module / pass-through？
- 纯函数抽出但 caller 编排仍不可测？
- untested 或只能 mock 内部才能测的路径？

对每个 suspect 做 **deletion test**。

### 2. 呈现候选（Markdown，不写进 repo）

输出 3–5 个候选，每项：

- **Files** — 涉及路径
- **Problem** — 为何造成 friction
- **Solution** —  plain English  deepening 方向
- **Benefits** — 可测性、locality、Agent 可导航性
- **Strength** — `Strong` / `Worth exploring` / `Speculative`
- **ADR 冲突** — 若有，标注是否值得 reopen

用 `CONTEXT.md` 词汇命名模块（如 **Close Gate**、**Project Hub**），不用 handler/service 泛称。

**Top recommendation** — 建议先做哪一个。

问用户：「要深入哪一个？」

### 3. Grilling loop

用户选定后：walk 设计树 — constraints、seam 位置、tests  survive refactor。

副作用 inline：

- 新术语 → 更新 `CONTEXT.md`
-  load-bearing 拒绝理由 → 可选 ADR

### 4. 实施边界

本 skill **只产出分析与设计对齐**；实际 refactor 须单独 Implement 任务 + 过 architecture-guard。

术语定义见 [LANGUAGE.md](LANGUAGE.md)。
