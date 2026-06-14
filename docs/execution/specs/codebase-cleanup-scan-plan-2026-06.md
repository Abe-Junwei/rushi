# 代码库全面清理 — 扫描方案（定稿）

> **状态**：Phase 0–1 已执行 · 见 [cleanup-candidate-register.md](./cleanup-candidate-register.md)  
> **原则**：先扫描分类，再 2–4h 薄片删除；禁止无台账批量删

## 目标与边界

清理：死代码、过期设计残留、文档漂移、冗余 `@deprecated` 层。  
不删：ADR 约束 spike、SenseVoice 迁移、archive 决策史、bundled 侧车资源。

## 流程

Phase 0 基线 → Phase 1 自动扫描 → 候选台账 → 风险复核 → Wave A–E → 每波 L0 闸门。

## 扫描域

| 域 | 工具 |
|----|------|
| TS/React | knip、rg `@deprecated`、architecture-guard |
| Rust | `allow(dead_code)`、permissions vs commands |
| ASR Python | vulture（可选）、README 路径对照 |
| 文档 | Superseded ADR、obsolete checklist、copy-drift 登记 |
| 脚本 | package.json 引用差集（手测保留） |

## 产物

- [cleanup-scan-baseline.md](./cleanup-scan-baseline.md)
- [cleanup-candidate-register.md](./cleanup-candidate-register.md)
- [cleanup-wave-log.md](./cleanup-wave-log.md)

## 验证闸门

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

触及 Rust/ASR 时追加 `cargo test` / `pytest`。
