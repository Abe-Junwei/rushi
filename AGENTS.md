# Agent instructions (Rushi)

**先读**：[`AI_QUICKSTART.md`](./AI_QUICKSTART.md) — 项目结构、当前热点、任务路由、典型模式。

## 通用执行纪律

源自 [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)。

1. **Think before coding**：澄清假设与歧义；多方案时说明取舍。
2. **Simplicity first**：只写满足需求的最小代码；不 speculative 抽象。
3. **Surgical changes**：只改与任务直接相关的行；匹配既有风格。
4. **Goal-driven**：用 typecheck / test / 可重复命令定义完成标准；未验证不宣称完成。

## 工作流四阶段

1. **Explore**：读相关 `src/` + `docs/architecture/` + `docs/adr/`，产出"已读清单"
2. **Plan**：产出落位文件 + 验证方式；确认后再实施
3. **Implement**：逐步验证（typecheck → 定向 test → 架构守卫）
4. **Commit**：commit msg 附验证证据

> 小修复（单文件 ≤ 10 行）可跳过 Explore，但 Commit 验证不可省。

## Rushi-specific（≤ 15 个 bullets）

- 目录落位见 AI_QUICKSTART §项目结构
- 复杂度阈值：hook > 300 行 / > 12 hooks → 拆分；`.rs` > 500 行 → 考虑拆模块
- 样式颜色唯一来源：`tailwind.config.js` / `src/config/tokens.ts`；禁止 `bg-[#...]`
- SQLite `PRAGMA busy_timeout = 5000`；路径用 `canonicalize` + `relative_to`
- Python async 端点同步 IO 必须 `run_in_threadpool`；上传文件流式处理
- 禁止：setState updater 内 DOM 查询 / 硬编码 hex / mega-hook
- 好/坏示例见 AI_QUICKSTART §典型模式
- 新增设计 → 先读 `docs/architecture/` 与 ADR
- 中等以上复杂度 → 先写 spec（`docs/execution/specs/` 三件套）再实施

## 机器守卫（提交前必跑）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## 文档与真源

- Rushi 内架构说明：`docs/architecture/`（索引见 [`docs/architecture/README.md`](./docs/architecture/README.md)）
- ADR：`docs/adr/`（索引见 [`docs/adr/README.md`](./docs/adr/README.md)）
- 与 Jieyu 文档冲突时：**以 Rushi 代码与本仓 ADR 为准**
