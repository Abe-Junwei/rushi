# Agent instructions (Rushi)

**先读**：[`AI_QUICKSTART.md`](./AI_QUICKSTART.md) — 项目结构、当前热点、任务路由、典型模式；[`CONTEXT.md`](./CONTEXT.md) — 领域词汇表（对话与命名与此一致）；桌面端做 UI / 重设计时再读仓库根 [`DESIGN.md`](./DESIGN.md)（与 Google Stitch 的 DESIGN.md 约定一致）。

## 通用执行纪律

源自 [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)。

1. **Think before coding**：澄清假设与歧义；多方案时说明取舍。
2. **Simplicity first**：只写满足需求的最小代码；不 speculative 抽象。
3. **Surgical changes**：只改与任务直接相关的行；匹配既有风格。
4. **Goal-driven**：用 typecheck / test / 可重复命令定义完成标准；未验证不宣称完成。

## 工作流四阶段

1. **Explore**：读 [`CONTEXT.md`](./CONTEXT.md) + 相关 `src/` + `docs/architecture/` + `docs/adr/`，产出"已读清单"
2. **Research**（**新功能 / 路线图薄片 / 中等及以上复杂度**）：对照业内 ≥2 条成熟路线，写 `docs/execution/specs/*-research.md`（模板 [`research-brief-template.md`](./docs/execution/specs/research-brief-template.md)），评估可复用度与「不做什么」；**未完成不得进入 Plan 定稿与业务编码**。细则：`.cursor/rules/feature-research-gate.mdc`；范例：[`r3-provider-configuration-research.md`](./docs/execution/specs/r3-provider-configuration-research.md)
3. **Plan**：产出落位文件 + 验证方式；**顶部链接 research brief**；确认后再实施
4. **Implement**：逐步验证（typecheck → 定向 test → 架构守卫）
5. **Commit**：commit msg 附验证证据

> 小修复（单文件 ≤ 10 行）可跳过 Explore / Research，但 Commit 验证不可省。

## 单人项目执行补充（UI 重设计期）

1. 不设置多人评审环节，改为“单人短循环 + 硬闸门”。
2. 每轮 2-4 小时，仅允许一个纵向薄片主题。
3. 每轮开始先刷新 Stitch 上传包：`bash scripts/prepare-stitch-upload.sh`。
4. 每轮结束必须通过：`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`。
5. 每轮至少手测一条主路径，并记录改动/验证/下一轮三行日志。

## Rushi-specific（≤ 15 个 bullets）

- 目录落位见 AI_QUICKSTART §项目结构
- 复杂度阈值：hook > 300 行 / > 12 hooks → 拆分；`.rs` > 500 行 → 考虑拆模块
- **视觉意图**：`apps/desktop` 的版面、组件气质、间距层次以仓库根 [`DESIGN.md`](./DESIGN.md) 为准（当前为 **Notion Zen**：Notion 中性底 + saffron 暖色强调；可与 Stitch 稿对齐）。
- **落码颜色**：样式颜色真源为 `apps/desktop/src/styles/tokens.css` → `zen-tailwind.css` `@theme` + `apps/desktop/src/config/tokens.ts`；将 `DESIGN.md` 色板映射为具名 token，禁止 `bg-[#...]` 与未入库 hex。见 [`docs/architecture/desktop-tailwind-v4.md`](./docs/architecture/desktop-tailwind-v4.md)。
- SQLite `PRAGMA busy_timeout = 5000`；路径用 `canonicalize` + `relative_to`
- Python async 端点同步 IO 必须 `run_in_threadpool`；上传文件流式处理
- 禁止：setState updater 内 DOM 查询 / 硬编码 hex / mega-hook
- 好/坏示例见 AI_QUICKSTART §典型模式
- 新增设计 → 先读 `docs/architecture/` 与 ADR
- **浮动对话框** → `compactDialog` + Notion/Zen（`controlStyles.ts`）；勿用已移除的 serene 面板变体；见 `docs/architecture/desktop-floating-dialog-panels.md`
- 中等以上复杂度 → **先调研 brief**（`docs/execution/specs/*-research.md`）→ 再写 spec 三件套 → 再实施；禁止无调研拍脑袋造轮子
- **能力—UI 状态对齐**（环境/ASR/设置）：编码前读 [`docs/architecture/desktop-capability-ui-state-alignment.md`](./docs/architecture/desktop-capability-ui-state-alignment.md)；acceptance 必填 **能力—UI 状态矩阵**；禁止用全局 `/health.ready_for_transcribe` 表示「用户所选模型」状态（路线图 §4.1.4 R3-STATE）

## 机器守卫（提交前必跑）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## Agent skills

项目技能在 [`.cursor/skills/`](./.cursor/skills/)（须**用户手动触发**）。索引：[`docs/agents/skills.md`](./docs/agents/skills.md)

| 场景 | 技能 |
|------|------|
| 中等以上功能 / 架构改动前对齐 | `grill-with-docs` |
| 难 bug / flaky / 侧车异常 | `diagnose` |
| 周期性架构体检 / guard hotspot | `improve-architecture` |

领域文档布局与 `CONTEXT.md` 消费规则：[`docs/agents/domain.md`](./docs/agents/domain.md)。工作追踪（spec 非 Issues）：[`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

## 文档与真源

- **领域词汇**：[`CONTEXT.md`](./CONTEXT.md)（glossary only；实现见 architecture）
- Rushi 内架构说明：`docs/architecture/`（索引见 [`docs/architecture/README.md`](./docs/architecture/README.md)）
- ADR：`docs/adr/`（索引见 [`docs/adr/README.md`](./docs/adr/README.md)）
- 桌面端产品视觉说明（Stitch / Agent 可读）：仓库根 [`DESIGN.md`](./DESIGN.md)
- 与 Jieyu 文档冲突时：**以 Rushi 代码与本仓 ADR 为准**
