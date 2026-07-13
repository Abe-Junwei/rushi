# Rushi · 如是我闻

![如是我闻](apps/desktop/src/assets/brand/lockup-readme.png)

**如是我闻** — 本地中文课录音转写与校对桌面应用（Tauri 2 + React + SQLite + Python ASR 侧车）。

- 欢迎页 → 项目 Hub → 编辑器（波形 + 语段列表）
- 本机 / 在线转写、校对、拆分合并、词表与纠错记忆
- 导出 TXT / SRT / DOCX；设置内可导出诊断包

**最新发行**：[v0.1.9](https://github.com/Abe-Junwei/rushi/releases/tag/v0.1.9)（macOS `aarch64.dmg` · Windows portable 分卷 zip；**无 Linux 桌面包**）。

版权见 [`LICENSE`](./LICENSE)（Copyright (c) **沂南灵创技术服务中心** · 专有软件 · 保留一切权利）。

实现与验收以**本仓** `docs/` 与代码为准。与 sibling **Jieyu**（解语）平级；对齐策略等见本仓 [`docs/architecture/`](./docs/architecture/)。

## 仓库结构

| 路径 | 说明 |
|------|------|
| [`apps/desktop`](./apps/desktop) | Tauri 2 + React（Vite）桌面壳 |
| [`services/asr`](./services/asr) | Python FastAPI ASR（`GET /health` · `POST /v1/transcribe`） |
| [`docs/`](./docs/) | 架构、ADR、验收与执行规格 |
| [`AI_QUICKSTART.md`](./AI_QUICKSTART.md) | Agent / 贡献者：落位、热点、任务路由 |

## 本地开发

**前置**：Node 22+ · Rust stable + [Tauri 前置依赖](https://tauri.app/start/prerequisites/) · Python 3.11+（推荐 3.12）。

ASR 包在 **`services/asr/`**，须用**独立 venv**（勿与 Open WebUI 等共用）。仓库根 `pip install -e .` 只会装占位元包，**不会**出现 `rushi_asr`。

```bash
# 终端 A：ASR（默认 http://127.0.0.1:8741，见 apps/desktop/.env.example）
bash scripts/bootstrap-asr-venv.sh
source services/asr/.venv/bin/activate
python -m rushi_asr

# 终端 B：桌面（仓库根）
npm ci
npm run desktop:dev
```

仅 UI（无 Tauri）：`cd apps/desktop && npm run dev`。若 `desktop:dev` 报找不到 `cargo`：`. "$HOME/.cargo/env"`，或按 [rustup](https://rustup.rs/) 安装后新开终端。

侧车构建 / 锁文件 / pytest 细节见 [`services/asr/README.md`](./services/asr/README.md)。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run desktop:dev` / `desktop:build` | Tauri 开发 / 打包 |
| `npm run typecheck` · `test` · `lint` | 桌面端检查 |
| `npm run asr:test` | ASR pytest（需已 bootstrap venv） |
| `node scripts/check-architecture-guard.mjs` | 架构守卫（hook 复杂度等） |
| `npm run desktop:test:e2e:desktop` | Playwright 桌面 E2E（mock，无需侧车） |

提交前建议：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## 文档索引

| 文档 | 内容 |
|------|------|
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | 贡献与许可注意 |
| [`AGENTS.md`](./AGENTS.md) | 代理工作契约 |
| [`docs/adr/`](./docs/adr/) | 架构决策（如独立仓 / SQLite / Python ASR） |
| [`docs/architecture/`](./docs/architecture/) | 架构真源 |
| [`docs/execution/`](./docs/execution/) | P0–P4 验收、路线图、并行 backlog、规格 |
| [`DESIGN.md`](./DESIGN.md) | 桌面视觉意图（Notion Zen） |
| [`CONTEXT.md`](./CONTEXT.md) | 领域词汇表 |

验收手测、评测清单与发行检查项不在本页展开，见 `docs/execution/` 下对应文档。
