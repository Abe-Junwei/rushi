# Agent instructions (Rushi)

面向在本仓库工作的 AI 编码代理与人的简要契约。**完整工程纪律**请先读 sibling 文档与计划（见下），再读本节。

## Rushi-specific（必读链接）

以下路径默认 **Rushi** 与 **Jieyu** 位于同一父目录（[`README.md`](./README.md)）。

1. **对齐真源**（规范包、代码白名单、禁止项）：[`../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md`](../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md)
2. **产品阶段与验收**：[`../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md`](../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)
3. **编排层 / 控制器 / 复杂度 / 面板 CSS 等**（中文全文，节选沿用）：[`../Jieyu/copilot-instructions.md`](../Jieyu/copilot-instructions.md) — 落地时按 Rushi 实际目录改写路径示例，**纪律等价**；勿照搬 Jieyu 专有域（协作云、多宿主翻译、ReadyWorkspace 等）除非产品范围纳入。

从 Jieyu **手抄**代码或模式时：保留来源注释（commit + path），并遵守 Jieyu 的 **ISC** 义务（见 [`LICENSE`](./LICENSE) 与 Jieyu 根目录 `LICENSE`）。

## 通用执行纪律（摘要）

源自 [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) 思想；与 Jieyu [`AGENTS.md`](../Jieyu/AGENTS.md) 同向，细节以该文件为准。

1. **Think before coding**：澄清假设与歧义；多方案时说明取舍。
2. **Simplicity first**：只写满足需求的最小代码；不 speculative 抽象。
3. **Surgical changes**：只改与任务直接相关的行；匹配既有风格。
4. **Goal-driven**：用 typecheck / test / 可重复命令定义完成标准；未验证不宣称完成。

## 文档与真源

- Rushi 内架构说明：`docs/architecture/`（当前索引见 [`docs/architecture/README.md`](./docs/architecture/README.md)）。
- 与 Jieyu 文档冲突时：**以 Rushi 代码与本仓 ADR 为准**；跨仓规范以上述对齐策略的修订日期为准。
