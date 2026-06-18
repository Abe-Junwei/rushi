# @rushi/desktop

如是我闻 **Tauri 2 + React（Vite）** 桌面壳。

- 仓库根 [`README.md`](../../README.md) — 环境、ASR 侧车、常用 npm 脚本、P0–P4 手测
- [`AI_QUICKSTART.md`](../../AI_QUICKSTART.md) — 目录落位、当前热点、任务路由
- 开发：`npm run desktop:dev`（在仓库根目录）
- 仅 UI（无 Tauri）：`npm run dev`（本目录）
- E2E：`npm run test:e2e:desktop`（mock Tauri + Vite；见 `tests/e2e/`）
- 提交前：`npm run typecheck && npm run test && node ../../scripts/check-architecture-guard.mjs`
