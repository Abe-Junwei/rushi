# Rushi

与 sibling 仓库 **[Jieyu](../Jieyu/)**（解语）**平级**，本目录路径：

`…/Obsremote/（50）开发/Rushi`

本仓库为 **如是我闻** 产品方向的 **独立代码仓**（本地中文转写、校对、导出等，以 Jieyu 内执行计划为范围真源）。

版权：见根目录 [`LICENSE`](./LICENSE)（Copyright (c) **沂南灵创技术服务中心**，ISC）。

## 目录（骨架）

| 路径 | 说明 |
|------|------|
| [`apps/desktop`](./apps/desktop) | **Tauri 2 + React（Vite）** 桌面壳；默认通过 `VITE_ASR_BASE_URL`（示例见 [`apps/desktop/.env.example`](./apps/desktop/.env.example)）请求本地 ASR。 |
| [`services/asr`](./services/asr) | **Python FastAPI**：`GET /health`；`POST /v1/transcribe`（multipart `file`）走 FFmpeg 规范化 + **stub / 可选 FunASR**，JSON 契约见 `apps/desktop/src/contracts/transcription.ts`。 |

## 本地开发

前置：**Node 20+**、**Rust（stable）+ 各 OS Tauri 前置依赖**（见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)）、**Python 3.11+**。

**Python 可安装包在 `services/asr/`**，不在仓库根。若在根目录执行 `pip install -e .`，只会装上占位元包 `rushi-repo-root`，**不会出现** `python -m rushi_asr`。请用下面任一方式安装 **rushi-asr**：

```bash
# 在仓库根（推荐路径写清楚）
pip install -e "./services/asr"

# 或先进入子目录
cd services/asr && pip install -e .
```

```bash
# 1）安装前端工作区依赖（仓库根目录）
npm ci

# 2）终端 A：启动 ASR（示例：在子目录建 venv）
cd services/asr
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
python -m rushi_asr

# 3）终端 B：启动桌面（Tauri + Vite）
cd /path/to/Rushi
npm run desktop:dev
```

仅调试前端 UI（无 Tauri、不调用 Rust）：`cd apps/desktop && npm run dev`。

## 常用命令（根目录）

| 命令 | 作用 |
|------|------|
| `npm run check:doc-links` | 校验 Markdown 内相对链接 |
| `npm run lint` | ESLint（`apps/desktop`） |
| `npm run typecheck` | TypeScript |
| `npm run test` | Vitest |
| `npm run build` | `tsc` + Vite 生产构建（不含完整 `tauri build` 安装包） |
| `npm run desktop:dev` / `npm run desktop:build` | Tauri 开发 / 打包 |

Python 单测：`pip install -e "./services/asr[dev]" && cd services/asr && python -m pytest`（或先 `cd services/asr` 再 `pip install -e ".[dev]"`）。

P0 批量冒烟（需已启动 `python -m rushi_asr`，且本机有 `ffmpeg` + `curl`）：

```bash
bash scripts/p0-sample-batch.sh 10
```

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
- [`docs/adr/`](./docs/adr/) — ADR（如 [`0001`](./docs/adr/0001-independent-repo-default-sqlite-python-asr.md) 独立仓 / SQLite / Python ASR）。

## 下一步（产品 / 工程）

- 按计划书 **P0**：导入音视频、FFmpeg 抽轨、与 ASR 契约对齐（`TranscriptionProvider` 等以本仓为真源）。
- 编排层遵守 [`../Jieyu/copilot-instructions.md`](../Jieyu/copilot-instructions.md) 节选纪律：**controller / service** 下沉，避免 mega-hook 与壳层误接。
- CI 已含文档链接、前端 lint/typecheck/test/build、`cargo check`、Python pytest；后续可加 **`tauri build` 打包容器**、E2E、架构 ratchet 等。
