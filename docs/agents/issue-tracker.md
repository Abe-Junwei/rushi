# Agent：工作追踪

本仓**不用 GitHub Issues 作为 spec 真源**；路线图与功能薄片在 `docs/execution/`。

## 真源路径

| 类型 | 路径 |
|------|------|
| 排期 | `docs/execution/plans/rushi-execution-roadmap.md` |
| 调研门禁 | `docs/execution/specs/*-research.md` |
| 功能 spec | `*-intent.md` / `*-plan.md` / `*-acceptance.md` |
| 并行 backlog | `docs/execution/specs/parallel-backlog-2026-06.md` |

## Agent 写 spec 时

- 新薄片：先 `*-research.md`，再链三件套
- acceptance 顶部链接 research + plan
- 机器闸门：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- Rust 改动：`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

## 不适用

Matt Pocock skills 的 `to-issues` / `triage` / GitHub label 状态机 — 本仓未配置。
