# Contributing to Rushi

## 开始之前

1. 阅读 [`README.md`](./README.md) 中的 Jieyu 文档链接。
2. 阅读对齐策略与计划书中的阶段边界、禁止项与验收口径。

## 代码与许可证

- 本仓库默认 **ISC**（见 [`LICENSE`](./LICENSE)）。
- 若片段衍生自 **Jieyu**，须保留 ISC 要求的版权与许可声明，并在文件头注明来源（见 [`AGENTS.md`](./AGENTS.md)）。

## 提交与评审

- 提交信息使用完整句子，说明「改了什么、为何」。
- 编排层不堆重业务逻辑；单模块复杂度要有意识控制（纪律见 [`../Jieyu/copilot-instructions.md`](../Jieyu/copilot-instructions.md) 节选）。

CI 已包含 **文档相对链接** 检查（`npm run check:doc-links`，于 GitHub Actions 中同命令）。应用代码落地后请补齐 `typecheck`、单测与 ESLint 等与评审约定。
