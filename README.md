# Rushi

与 sibling 仓库 **[Jieyu](../Jieyu/)**（解语）**平级**，本目录路径：

`…/Obsremote/（50）开发/Rushi`

本仓库为 **如是我闻** 产品方向的 **独立代码仓**（本地中文转写、校对、导出等，以 Jieyu 内执行计划为范围真源）。

版权：见根目录 [`LICENSE`](./LICENSE)（Copyright (c) **沂南灵创技术服务中心**，ISC）。

## 与 Jieyu 的文档链接

以下路径假设 **Rushi** 与 **Jieyu** 位于同一父目录 `（50）开发/` 下（与当前本机布局一致）。若你单独克隆 Rushi，请将 Jieyu 克隆为同级目录或自行调整链接。

| 文档 | 相对路径（从本 README） |
|------|-------------------------|
| 独立仓与 Jieyu 对齐策略（规范 / 白名单 / 禁止项） | [`../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md`](../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md) |
| 本地版改进计划书（阶段 / 验收） | [`../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md`](../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md) |

本仓 [`docs/architecture/README.md`](./docs/architecture/README.md) 中有从 `docs/` 子路径出发的等价链接。

## 仓库内文档

- [`LICENSE`](./LICENSE) — ISC（与 Jieyu 一致，便于手抄兼容片段）。
- [`AGENTS.md`](./AGENTS.md) — 代理与人的工作契约骨架（链向 Jieyu 对齐策略与 `copilot-instructions.md`）。
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — 贡献与拷贝 Jieyu 代码时的许可注意。

## 下一步

- **已完成（初始化清单）**：最小 CI（[`/.github/workflows/ci.yml`](./.github/workflows/ci.yml) 文档链接检查）、首条 ADR（[`docs/adr/0001-independent-repo-default-sqlite-python-asr.md`](./docs/adr/0001-independent-repo-default-sqlite-python-asr.md)）。
- **待办**：引入应用代码与 Tauri / Python 推理侧目录后，补齐 `typecheck`、单测与 ESLint 等门禁（见对齐策略 §6.3）。

本地校验文档链接：`npm run check:doc-links`（若已克隆同级 `Jieyu`，会校验指向该仓的相对链接是否可解析）。
