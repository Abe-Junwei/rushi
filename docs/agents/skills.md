# Agent Skills 使用指南

项目技能位于 [`.cursor/skills/`](../../.cursor/skills/)。均为 **`disable-model-invocation: true`** — 须**你手动触发**（对话中说 skill 名或描述意图），Agent 不会自动加载。

## 何时用哪个

| 场景 | 技能 | 你怎么说 |
|------|------|----------|
| 开做中等以上功能、架构改动、需求仍模糊 | `grill-with-docs` | 「grill 这个方案」/「按 grill-with-docs 对齐」 |
| 难 bug、flaky、性能回归、ASR/侧车异常 | `diagnose` | 「按 diagnose 查这个 bug」 |
| 每 1–2 周或 architecture-guard hotspot | `improve-architecture` | 「跑一轮架构 review」 |
| 换会话继续长任务 | Cursor 内置 `handoff`（个人 skill） | 「写 handoff」 |

## 与现有工作流串联

```text
grill-with-docs → 更新 CONTEXT.md
       ↓
research brief → intent / plan / acceptance
       ↓
Implement（acceptance 要求 TDD 时见 spec-template §TDD）
       ↓
typecheck + test + architecture-guard
```

**Research gate 不可跳过**：`.cursor/rules/feature-research-gate.mdc` 仍优先于 grill；grill 发生在 research **之前或之中**，用于对齐术语与范围。

## 自动生效（无需手动 skill）

- `AGENTS.md` + `CONTEXT.md` 链 — 每次任务 Agent 应读
- `npm run typecheck && npm run test && check-architecture-guard` — 提交闸门
- Jieyu 拆分纪律 — hook/controller 阈值

## 维护

- 新领域术语：grill 或功能落地后补 `CONTEXT.md`
- 技能正文：改 `.cursor/skills/*/SKILL.md`；本文件只索引触发场景
