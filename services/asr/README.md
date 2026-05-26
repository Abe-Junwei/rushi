# rushi-asr

本地 ASR HTTP 服务：默认只绑定 **127.0.0.1**；与桌面壳通过 **TranscriptionResult v1** 契约对齐（字段与 `apps/desktop/src/contracts/transcription.ts` 一致）。

## 侧车二进制（桌面安装包，Windows + macOS）

**产品真源**（推理侧车、双 mac 架构、Win x64 双 exe、签名、模型缓存、版本）：[`docs/architecture/asr-sidecar-funasr-policy.md`](../../docs/architecture/asr-sidecar-funasr-policy.md)。  

**侧车依赖锁（pip）**（Python **3.12**；CPU 用 PyTorch `whl/cpu`，Windows CUDA 用 **`cu126`** 与 CPU 锁同源非 torch 包）：

| 文件 | 用途 |
|------|------|
| `requirements-sidecar-cpu-macos-arm64.lock` | macOS arm64 真源锁（`torch==2.11.0` CPU + FunASR 传递依赖） |
| `requirements-sidecar-cpu-macos-x86_64.lock` | `-r` 引用 arm64 锁（同 pins，Intel 上解析 x86_64 轮子） |
| `requirements-sidecar-cpu-win_amd64.lock` | `-r` 引用 arm64 锁（Windows CPU 侧车） |
| `requirements-sidecar-cuda-win_amd64.lock` | `rushi-asr-sidecar-cuda.exe`：`torch*+cu126` + 其余与 CPU 锁一致 |

更新：仓库根 `bash scripts/regen-sidecar-cpu-lock.sh`，再 `bash scripts/regen-sidecar-cuda-win-lock.sh`（CUDA 文件中 `+cu126` 版本需与 [PyTorch 索引](https://download.pytorch.org/whl/cu126/) 对齐）。

**macOS / Windows**：`bash scripts/build-asr-sidecar-unix.sh`（Darwin）或 `scripts/build-asr-sidecar-windows.ps1` 会  
`pip install -r` 对应 **`requirements-sidecar-cpu-*.lock`**，下载 **ffmpeg-static**（脚本 `scripts/fetch-ffmpeg-sidecar.sh`），再 **PyInstaller** 打出带 **FunASR + CPU torch + 同目录 ffmpeg/ffprobe** 的 onedir。  
**Windows CUDA**：同一 PowerShell 脚本加 **`-Variant Cuda`**，使用 **`requirements-sidecar-cuda-win_amd64.lock`**，输出到 **`bundled-asr/rushi-asr-sidecar-cuda/`**（`rushi-asr-sidecar-cuda.exe`）。  
**Linux x86_64**：`bash scripts/build-asr-sidecar-unix.sh` 使用 **`requirements-sidecar-cpu-linux_x86_64.lock`**（`-r` 引用 macOS arm64 真源锁）+ **linux-x64** ffmpeg-static，打 **全量 FunASR** onedir（**工程用**；产品对外支持矩阵见 [`docs/architecture/asr-sidecar-funasr-policy.md`](../../docs/architecture/asr-sidecar-funasr-policy.md)，**不承诺** Linux 桌面正式侧车）。**其他架构 / 非 Linux** 仍为 **stub**。

桌面壳将 CPU onedir 置于 `apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/`（Windows 可选再加 `rushi-asr-sidecar-cuda/`）；若 `http://127.0.0.1:8741/health` 尚不可用则**自动拉起**侧车，退出时结束；**8741 已被占用时不启动**（请先停本机 `python -m rushi_asr` 再测侧车）。Windows 上在探测到 NVIDIA 驱动与 `nvidia-smi` 时会优先尝试 CUDA 包，失败则回退 CPU；`RUSHI_FORCE_BUNDLED_ASR_CPU=1` 强制只用 CPU 包。

- **构建**：`npm run asr:build-sidecar-unix` 或 `npm run asr:regen-sidecar-locks`（仅锁）+ 上列脚本。
- **禁用**：`RUSHI_SKIP_BUNDLED_ASR=1`。
- **资源说明**：`apps/desktop/src-tauri/resources/bundled-asr/README.txt`。

## 运行

**`pyproject.toml` 在本目录**，不要在仓库根目录用 `pip install -e .` 代替本包（根目录另有占位元包，不含 `rushi_asr`）。在仓库根请执行：`pip install -e "./services/asr"`。

**不要**把本包装进与 Open WebUI / TensorFlow / langchain 等**共用的** Python 环境：会升级 `pydantic`、`numpy` 并产生 resolver 冲突。请始终在本目录下 `python3 -m venv .venv` 后 `source .venv/bin/activate` 再 `pip install -e .`；或从仓库根执行 `bash scripts/bootstrap-asr-venv.sh`。启动用 **`python -m rushi_asr`**（venv 内）或 **`python3 -m rushi_asr`**（已对准该解释器时）。

```bash
cd services/asr
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
python -m rushi_asr
```

`pip install -e` 必须带路径：末尾 **`.`** 表示当前目录；写成 `pip install -e` 会报错。开发跑测试：`pip install -e ".[dev]"`；或在**仓库根**执行 **`npm run asr:test`**（调用 `scripts/run-asr-pytest.sh`，自动选用 `python3.12` / `3.11` / `3` 并在 `services/asr/.venv` 安装依赖后跑 `pytest`，与 CI `asr` job 一致）。

默认端口 **8741**。环境变量：

- `ASR_HOST`（默认 `127.0.0.1`）
- `ASR_PORT`（默认 `8741`）
- `RUSHI_LOCAL_TOKEN`（可选；设置后对写接口启用本地 token 校验，请在请求头带 `x-rushi-local-token`）

## 依赖

- **ffmpeg / ffprobe**：须在 `PATH` 中，用于上传文件的解码与 **16 kHz mono WAV** 规范化。
- **可选 FunASR**：`pip install -e ".[funasr]"` 后可选设置 `RUSHI_FUNASR_MODEL`（例如 `paraformer-zh`）；**未设置时使用内置默认** `iic/SenseVoiceSmall`。默认模型与必需辅助模型建议先通过 `POST /v1/models/prepare-default` 或桌面端「下载默认模型」准备完成；未安装 FunASR 时仍走 **stub**（单段、空文本、带 `detail` 说明）。
- **模型缓存目录**：桌面壳启动内置侧车时会设置 **`RUSHI_MODELS_ROOT`**（`{应用数据}/studio.lingchuang.rushi/models/`）并映射 **`MODELSCOPE_CACHE`** / **`HF_HOME`** 至其下子目录；本机 `python -m rushi_asr` 也可自行 `export RUSHI_MODELS_ROOT=...` 以统一权重落盘位置。
- **可选 manifest 校验**：`RUSHI_MODEL_VERIFY_MANIFEST` 指向 JSON 文件（相对路径则相对 `RUSHI_MODELS_ROOT`），在 `POST /v1/models/prepare-default`（及异步路径完成时）对列出的文件做 **SHA256** 校验；不匹配返回 **400**（见 `rushi_asr/model_manifest_verify.py`）。Manifest 为对象数组，每项含 `path` 或 `rel`（相对 `RUSHI_MODELS_ROOT`）、`sha256`（小写十六进制）。

可选调参：

- `RUSHI_FUNASR_DEVICE`（默认 `cpu`）
- `RUSHI_FUNASR_LANGUAGE`（默认 `zh`）
- `RUSHI_FUNASR_VAD_MODEL`（默认 `fsmn-vad`；设为空字符串可关闭 VAD 参数传递）

## 接口

- `GET /health` — 在 `status` / `service` 之外返回 **运行时能力**（供桌面自动检测）：`ffmpeg_ok`、`funasr_import_ok`（能否 `import funasr`）、`funasr_model_configured`（当前是否存在有效模型 id）、`funasr_model_explicit_from_env`（是否显式设置了 `RUSHI_FUNASR_MODEL`）、`funasr_ready`（仅表示运行时可用，不等于可直接转写）、`funasr_default_model_cached`、`funasr_vad_model_cached`、`funasr_required_models_cached`（当前必需模型是否完整）、`ready_for_transcribe`（运行时 + 必需模型均完成）、`transcription_mode`（`funasr` 或 `stub`）、`funasr_model_id`（未设置时返回内置默认 id）。
- `POST /v1/models/prepare-default` — 同步触发默认 FunASR 模型准备（下载/校验）；无 FunASR 时 **503**；manifest 校验失败 **400**。
- `POST /v1/models/prepare-default/async` — 在后台线程启动同上准备；立即返回 **202**；无 FunASR 时 **503**。
- `GET /v1/models/prepare-status` — 查询异步准备状态：`phase` 为 `idle` | `running` | `done` | `error`；`done` 时含 `result`（与同步成功体同形），`error` 时含 `message`。
- **桌面一键安装（可选）**：仓库根脚本 `scripts/install-funasr-for-desktop.sh` 会在 `services/asr/.venv` 中执行 `pip install -e ".[funasr]"`；需本机已有 **Python 3**、**网络**与足够磁盘；**不会**代替用户设置 `RUSHI_FUNASR_MODEL`，也**不会**自动重启 ASR 进程。
- `POST /v1/transcribe` — `multipart/form-data`：字段 **`file`**（必填）；可选字段 **`hotwords`**（UTF-8 文本，空格分隔热词，供 FunASR `generate(..., hotword=...)`；**stub 或未走 FunASR 时忽略**，并在 `warnings` 中加入 `hotwords_ignored_stub`）。响应为 **TranscriptionResult** JSON（`schema_version: "1"`）。

若设置了 `RUSHI_LOCAL_TOKEN`，以下写接口都需要请求头 `x-rushi-local-token: <token>`，否则返回 **401**：

- `POST /v1/transcribe`
- `POST /v1/models/prepare-default`
- `POST /v1/models/prepare-default/async`

## 测试

```bash
pytest
```

（含需 **ffmpeg** 的集成用例；CI 已安装 ffmpeg。）

## P0 验收

见仓库根 [`docs/execution/p0-acceptance.md`](../../docs/execution/p0-acceptance.md) 与脚本 `scripts/p0-acceptance.sh`、`scripts/generate-p0-chinese-samples-macos.sh`。
