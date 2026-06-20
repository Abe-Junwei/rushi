# Contributing to Rushi

## 开始之前

1. 阅读 [`README.md`](./README.md) 中的 Jieyu 文档链接。
2. 阅读对齐策略与计划书中的阶段边界、禁止项与验收口径。

## 代码与许可证

- 本仓库 **如是我闻** 主软件为 **商业许可（专有）**（见 [`LICENSE`](./LICENSE)）。
- 若片段衍生自 **Jieyu**（ISC），须保留 ISC 要求的版权与许可声明，并在文件头注明来源（见 [`AGENTS.md`](./AGENTS.md)）。

## 提交与评审

- 提交信息使用完整句子，说明「改了什么、为何」。
- 编排层不堆重业务逻辑；单模块复杂度要有意识控制（纪律见 [`../Jieyu/copilot-instructions.md`](../Jieyu/copilot-instructions.md) 节选）。

CI 包含：文档相对链接（`npm run check:doc-links`）、桌面端 `lint` / `typecheck` / `test` / `build`、`cargo check`（`apps/desktop/src-tauri`）、**`npm run asr:test`**（`services/asr` 的 pytest，与 workflow `asr` job 使用同一 `scripts/run-asr-pytest.sh`）。提交前建议在仓库根目录跑一遍 `npm ci` 后的上述 npm 脚本，并执行 **`npm run asr:test`**（需本机 Python 3.11+）。

Windows 安装包发布前人工项见 [`docs/execution/windows-release-checklist.md`](./docs/execution/windows-release-checklist.md)。
