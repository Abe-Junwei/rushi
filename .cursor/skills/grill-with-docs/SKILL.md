---
name: grill-with-docs
description: >-
  Relentlessly interviews the user about a plan, challenges terms against
  CONTEXT.md, and updates CONTEXT.md and ADRs inline. Use before medium-or-larger
  Rushi features, architecture changes, or when the user says grill, align the
  plan, or stress-test a design.
disable-model-invocation: true
---

# Grill with Docs（Rushi）

一次只问一个问题；每问等用户回复再继续。能靠读代码回答的问题，**先探索代码**。

先读 [`CONTEXT.md`](../../../CONTEXT.md)、相关 `docs/architecture/`、`docs/adr/`。

## 与 Research gate 的关系

- **中等及以上复杂度**：grill 对齐范围与术语 → 再写 `docs/execution/specs/*-research.md` → 再 intent/plan/acceptance
- **小修复（≤10 行）**：可跳过；用户明确要求时仍可用本 skill

## 会话中必须做

### 挑战词汇表

用户用语与 `CONTEXT.md` 冲突时立刻指出：「CONTEXT 里 X 指 …，你现在说的是 Y？」

###  sharpen 模糊词

「account / 模型 / 就绪」等 overloaded 词 → 提议 canonical 术语（对齐 D1–D6 等已有维度）。

### 场景压测

用具体场景探边界（Close Gate 链、D1≠D2、换文件未保存、侧车 stale…）。

### 对照代码

用户陈述与实现不符时 surface：「代码在 A 处做了 B，与你刚说的 C 矛盾 — 以哪个为准？」

###  inline 更新 CONTEXT.md

术语落定**当场**写入；格式：

```md
**Term**:
One or two sentences.
_Avoid_: synonym1, synonym2
```

`CONTEXT.md` **仅 glossary** — 不写实现步骤、不写 spec 正文。

### ADR  sparingly

仅当三者同时成立才提议 ADR：难逆转、无上下文会令人意外、有真实 trade-off。格式见 `docs/adr/` 现有条目。

## 结束条件

共享理解达成后，总结：术语变更、待写 research/spec、明确「不做什么」。若用户要编码，确认 research brief 是否仍缺。

工作追踪真源见 [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md)。
