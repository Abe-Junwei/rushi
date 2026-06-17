# Rushi

与 sibling 仓库 **Jieyu**（解语）**平级**，本目录路径：

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

**Python 可安装包在 `services/asr/`**，不在仓库根。若在根目录执行 `pip install -e .`，只会装上占位元包 `rushi-repo-root`，**不会出现** `rushi_asr`。

**务必使用独立 venv**，不要装在与 **Open WebUI、TensorFlow、langchain** 等共用的环境里：否则 pip 会升级 `pydantic` / `numpy` 等，既污染全局，也会触发你看到的 dependency conflicts。

`pip install -e …` **在同一个 venv 里只需做一次**；以后每次启动服务只需 `source …/activate` 再 `python -m rushi_asr`。只有改了依赖、`pyproject.toml`、或重建了 `.venv` 才需要再装。

```bash
# 一键：在 services/asr/.venv 里安装并隔离（推荐，仅首次或重建 venv 后）
bash scripts/bootstrap-asr-venv.sh
source services/asr/.venv/bin/activate
python -m rushi_asr
```

手动等价步骤（macOS 通常只有 `python3`，没有 `python`；**激活 venv 后** 里会有 `python`）：

```bash
cd services/asr
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
python -m rushi_asr
```

未激活 venv 时可直接：`python3 -m rushi_asr`（仅当该 `python3` 对应的环境里已安装 `rushi-asr`）。

```bash
# 1）安装前端工作区依赖（仓库根目录）
npm ci

# 2）终端 A：启动 ASR — 见上文「独立 venv」；勿用与 Open WebUI 等共用的全局 pip

# 3）终端 B：启动桌面（Tauri + Vite）
cd /path/to/Rushi
npm run desktop:dev
```

仅调试前端 UI（无 Tauri、不调用 Rust）：`cd apps/desktop && npm run dev`。

**若 `npm run desktop:dev` 报错 `cargo metadata` / `No such file or directory (os error 2)`**：当前终端里没有 `cargo`。先执行 `command -v cargo`；若没有输出：

1. **若已用 rustup 装过 Rust**（本机常见）：把 Cargo 加入 PATH（可写入 `~/.zshrc` 长期生效）：

   ```bash
   . "$HOME/.cargo/env"
   ```

   然后再 `npm run desktop:dev`。

2. **若从未安装**：按 [Rust 安装](https://rustup.rs/) 安装后**新开一个终端**，或同样执行上面的 `. "$HOME/.cargo/env"`。

## 常用命令（根目录）

| 命令 | 作用 |
|------|------|
| `npm run check:doc-links` | 校验 Markdown 内相对链接（**仓库根**或 `apps/desktop` / `src-tauri` 下均可） |
| `npm run lint` | ESLint（`apps/desktop`） |
| `npm run typecheck` | TypeScript |
| `npm run test` | Vitest |
| `npm run build` | `tsc` + Vite 生产构建（不含完整 `tauri build` 安装包） |
| `npm run desktop:dev` / `npm run desktop:build` | Tauri 开发 / 打包 |
| `npm run p4:eval-placeholders` | 生成 P4 评测用五段占位 wav（需 ffmpeg，见 `fixtures/eval/`） |
| `npm run eval:eval-run` | 按清单批跑本机 ASR并打印 JSON 报告（需 ASR 已启动、系统有 **curl**；见 `docs/execution/stabilization.md`） |
| `npm run asr:build-sidecar-unix` | **macOS** 或 **Linux x86_64**：PyInstaller **FunASR** 侧车；其他 Linux 架构为 **stub**。产物在 `apps/desktop/src-tauri/resources/bundled-asr/` |
| `npm run asr:build-sidecar-windows-cpu` / `asr:build-sidecar-windows-cuda` | **Windows**：分别打 **CPU** 与 **CUDA** 侧车目录（需本机 PowerShell）；`desktop:build` 时壳在 8741 空闲时**自动拉起**（探测 N 卡优先 CUDA，失败回退 CPU；`RUSHI_SKIP_BUNDLED_ASR=1` 禁用） |
| `npm run asr:regen-sidecar-locks` | 在 `services/asr` 用 **Python 3.12** 重生成 **`requirements-sidecar-cpu-macos-arm64.lock`** 与 **`requirements-sidecar-cuda-win_amd64.lock`**（需网络；见 `services/asr/README.md`） |

Python 单测（与 CI 一致，需本机 **Python 3.11+**，推荐 3.12）：**`npm run asr:test`**（脚本 `scripts/run-asr-pytest.sh` 会在 `services/asr/.venv` 安装 `.[dev]` 后跑 `pytest`）。亦可手动：`bash scripts/bootstrap-asr-venv.sh` 后 `cd services/asr && source .venv/bin/activate && python -m pytest`。

**P0 验收（计划书 §8，本仓真源见 [`docs/execution/p0-acceptance.md`](./docs/execution/p0-acceptance.md)）**

1. 启动 ASR（独立 venv，`python -m rushi_asr`）。
2. 准备 **10 条** `fixtures/p0-samples/*.wav`：macOS 可 `bash scripts/generate-p0-chinese-samples-macos.sh`（需系统中文语音 + ffmpeg）。
3. `bash scripts/p0-acceptance.sh`（默认只校验 **契约 + 时间段 + 可降级置信度**；stub 下可为空文本语段，或返回空语段并附 `stub_no_placeholder_segment` warning）。
4. 若已配置 FunASR 且要求每条有中文文本：`export P0_REQUIRE_NONEMPTY_TEXT=1` 后再跑第 3 步。

合成正弦波快速冒烟（不要求中文文本）：`bash scripts/p0-sample-batch.sh 10`。

**P1 手测（本地项目 / 校对 / 导出，计划书 P1）**

1. 终端 A：按上文启动 ASR（默认 `http://127.0.0.1:8741`，与 `apps/desktop/.env.example` 中 `VITE_ASR_BASE_URL` 一致）。
2. 终端 B：`npm run desktop:dev`，在壳内打开 **「本地项目与校对（P1–P4）」** 面板。打开后会 **自动请求 `GET /health`**，展示 FFmpeg / FunASR / `RUSHI_FUNASR_MODEL` 是否就绪；在 **macOS / Linux** 且本机有 Git 克隆的仓库时，可按面板提示 **一键安装 FunASR 依赖**（仍需手动设模型变量并重启 ASR）。
3. 输入名称 → **选择音频** → **创建项目**；在 **打开** 下拉中选中该项目。
4. **从 ASR 拉取语段**（将项目内音频副本 POST 到 `/v1/transcribe`）；在表格中改时间或文本，必要时 **拆分 / 合并**。
5. **保存到 SQLite**（应用数据目录下的 `studio.lingchuang.rushi/rushi.sqlite3`）；**导出 TXT / SRT**会弹出系统「另存为」，内容为 UTF-8、LF。**导出 DOCX（逐字稿 / 讲稿）** 同样为「另存为」，由壳内 `docx-rs` 生成最小版式（逐字稿：每段带时间行 + 正文，低置信段黄底高亮；讲稿：连续正文）。
6. **P4 诊断**：点 **「导出诊断包（zip）」**，内含版本/平台说明、**最近编辑流水**（`edit_log`）、**`logs/*.log` 尾部**（含 `desktop.log` 转写失败摘要）；若本地库不超过 5MiB 会附带 `rushi.sqlite3`。安装包 **Resources** 内含 **`user-guide-zh.md`** 简版说明（路径随平台在 Tauri 资源目录）；详细流程见应用内 **设置 → 使用说明**。

**P1 验收口径（本仓）**：计划书 §8 P1 验收 3 在 Rushi 内**放宽**为「保存批次写入 `edit_log` + 诊断包导出取证」，不要求逐键/逐拖动的持久化审计；见 [`docs/execution/acceptance.md`](./docs/execution/acceptance.md)。

**P4 评测占位音频（可选）**：`bash scripts/eval-generate-placeholders.sh`（需 ffmpeg），与 [`fixtures/eval/eval_manifest.v1.json`](./fixtures/eval/eval_manifest.v1.json) 中路径对应。占位生成后可在仓库根执行 **`npm run eval:eval-run`**（需本机 ASR + curl）得到 JSON 报告。

## 与 Jieyu 的文档链接

以下路径假设 **Rushi** 与 **Jieyu** 位于同一父目录 `（50）开发/` 下（与当前本机布局一致）。若你单独克隆 Rushi，请将 Jieyu 克隆为同级目录或自行调整链接。

| 文档 | 相对路径（从本 README） |
|------|-------------------------|
| 独立仓与 Jieyu 对齐策略（规范 / 白名单 / 禁止项） | `../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md` |
| 本地版改进计划书（阶段 / 验收） | `../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md` |

本仓 [`docs/architecture/README.md`](./docs/architecture/README.md) 中有从 `docs/` 子路径出发的等价链接。

## 仓库内文档

- [`LICENSE`](./LICENSE) — ISC（与 Jieyu 一致，便于手抄兼容片段）。
- [`AGENTS.md`](./AGENTS.md) — 代理与人的工作契约骨架（链向 Jieyu 对齐策略与 `copilot-instructions.md`）。
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — 贡献与拷贝 Jieyu 代码时的许可注意。
- [`docs/adr/`](./docs/adr/) — ADR（如 [`0001`](./docs/adr/0001-independent-repo-default-sqlite-python-asr.md) 独立仓 / SQLite / Python ASR）。
- [`docs/execution/p0-acceptance.md`](./docs/execution/p0-acceptance.md) — P0 验收：本机 ASR 契约、脚本与可降级口径。
- [`docs/execution/acceptance.md`](./docs/execution/acceptance.md) — P1 验收：本仓对计划书「编辑追溯」的放宽口径与手测建议。
- [`docs/execution/p2-acceptance.md`](./docs/execution/p2-acceptance.md) — P2 验收：术语偏置、低置信、纠错记忆与错词提示。
- [`docs/execution/p3-acceptance.md`](./docs/execution/p3-acceptance.md) — P3 验收：TXT/SRT/DOCX 与逐字稿/讲稿导出闭环。
- [`docs/execution/stabilization.md`](./docs/execution/stabilization.md) — P4 评测集、指标、批量检查点、安装包与诊断包说明。

## 下一步（产品 / 工程）

- **P0（已完成）**：导入音视频、FFmpeg 抽轨、ASR 契约与验收脚本闭环（见 [`docs/execution/p0-acceptance.md`](./docs/execution/p0-acceptance.md)）。
- **P1（已完成）**：桌面壳内项目 + SQLite 语段 + 编辑保存 + TXT/SRT 导出（见 [`docs/execution/acceptance.md`](./docs/execution/acceptance.md)）。
- **P2（已完成）**：术语库 + 热词注入 + 低置信链路；补齐 **纠错记忆 / 错词规则提示**（见 [`docs/execution/p2-acceptance.md`](./docs/execution/p2-acceptance.md)）。
- **P3（已完成）**：TXT/SRT/DOCX 三格式导出，含逐字稿/讲稿模式与低置信样式（见 [`docs/execution/p3-acceptance.md`](./docs/execution/p3-acceptance.md)）。
- **P4（已完成）**：评测清单、指标脚本、批跑命令、CI 冒烟、诊断包与安装包资源（见 [`docs/execution/stabilization.md`](./docs/execution/stabilization.md)）。
- 编排层遵守 [`../Jieyu/copilot-instructions.md`](../Jieyu/copilot-instructions.md) 节选纪律：**controller / service** 下沉，避免 mega-hook 与壳层误接。
- CI：文档链接、前端 lint/typecheck/test/build、`cargo check`、**`tauri build`（deb）**、Python pytest、**stub ASR 上的 `eval-run.py`**；后续可加 E2E、架构 ratchet 等。
