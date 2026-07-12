# ASR 侧车 + FunASR 产品策略（已定版）

本文档为 **Rushi 本仓真源**：与实现冲突时以代码与 ADR 为准；策略变更应更新本文件并保留日期。

---

## 0. 总形态（已定）

采用 **B. 推理侧车**：**torch + FunASR 打进侧车**；**默认 Paraformer 三件套随安装包**（v0.1.8+），**首启 seed** 到 App Data 缓存；**不**再默认 ModelScope 在线下载。

| 维度 | 决策 |
|------|------|
| 目标用户 | **纯小白**：尽量不依赖终端；关键步骤有界面引导与可恢复错误提示。 |
| 网络 | **v0.1.8 默认 SKU 不要求联网**：首启本地 seed；**在线 STT** 仍可能需要网络。SenseVoice / ModelScope prepare **v0.1.8 不提供**。 |
| 磁盘预算 | 用户侧 **总计约 5GB** 可接受（安装包 + 侧车 + 已下载模型缓存）；超额时 **硬提示**，并允许用户选择是否继续（见历史讨论）。 |
| 算力 | **CPU 必须可用**（兜底）；**Apple Silicon 用 MPS**；**NVIDIA 用 CUDA**（见 §3）。 |
| Windows CUDA 侧车 | **默认同包附带** `rushi-asr-sidecar-cuda.exe`（与 CPU 包一并安装，运行时二选一；见 §10）。 |

---

## 1. 平台与产物矩阵（已定）

| 平台 | 架构 | 侧车产物 |
|------|------|----------|
| **macOS** | **arm64 与 x86_64 均需** 独立构建与分发 | 每个架构各自一份 **CPU/MPS** 侧车目录（PyInstaller onedir）；安装包仅嵌入 **与当前构建架构一致** 的那一份。 |
| **Windows** | **仅 x64** | **两个可执行文件**：**`rushi-asr-sidecar.exe`**（CPU 基线，锁见 `requirements-sidecar-cpu-win_amd64.lock`）与 **`rushi-asr-sidecar-cuda.exe`**（锁见 `requirements-sidecar-cuda-win_amd64.lock`）。**默认安装介质同时附带二者**；运行时由壳 **探测 N 卡与驱动** 后 **二选一启动**；探测失败或 CUDA 不可用时 **只用 CPU 包**。 |

**Linux 桌面**：当前策略 **不包含** 正式侧车矩阵；**产品对外不承诺** Linux 桌面原生侧车与安装包矩阵（开发者沿用源码 venv；仓内 Linux x86_64 构建脚本与锁文件仅供工程与 CI，不代表终端用户支持级别）。若产品纳入，再单列矩阵。

---

## 2. 依赖与版本锁定（已定）

- **CPU / PyTorch（及 FunASR 等）**：使用 **PyPI + PyTorch 官方索引**（`--index-url https://download.pytorch.org/whl/cpu` 等）；版本在 `services/asr/` 下 **分文件锁定**：
  - **`requirements-sidecar-cpu-macos-arm64.lock`**：macOS arm64 **真源**（`pip freeze` 生成；**Python 3.12**）。
  - **`requirements-sidecar-cpu-macos-x86_64.lock`** / **`requirements-sidecar-cpu-win_amd64.lock`**：`-r` 引用 arm64 锁（同版本号，由目标平台解析对应 wheel）。
  - **`requirements-sidecar-cuda-win_amd64.lock`**：`torch` / `torchvision` / `torchaudio` 使用 **`+cu126`**（**cp312、win_amd64**），其余与 CPU 锁一致；由 `scripts/regen-sidecar-cuda-win-lock.sh` 在 CPU 锁变更后重生成。
- 侧车 CI / 本地构建：**仅** `pip install -r <对应 lock>` 后再 PyInstaller；更新锁：先 `bash scripts/regen-sidecar-cpu-lock.sh`，再 `bash scripts/regen-sidecar-cuda-win-lock.sh`（若 bump torch，需核对 `cu126` 上 Windows 轮是否存在）。
- **ffmpeg**：**侧车内自带** `ffmpeg` / `ffprobe` **二进制**（与侧车同签/同包），**不依赖**用户 PATH。许可（如 GPL/LGPL）在发布说明与 `NOTICE` 中列明。
- **默认 `RUSHI_FUNASR_MODEL`**：选用 **许可明确允许再分发** 的模型 ID（实现时在配置常量与 README 写死 **一个** 默认 SKU；若仅允许「运行时从官方拉取」则下载 URL 与许可条款仍须在合规附录中备案）。

---

## 3. GPU 策略（已定，与初版文档不同）

- **macOS（arm64 / x86_64）**：单一侧车可执行文件内为 **CPU wheel + MPS**；运行时 **MPS 可用则优先 MPS**，否则 **CPU**。
- **Windows x64**：**CUDA 不设为「下载替换 torch」**，而是 **单独产物 `rushi-asr-sidecar-cuda.exe`**（及配套 onedir），与 CPU 包 **并列且默认一并随应用安装**；运行时由壳 **探测 N 卡与驱动** 后选用 **cuda** 或 **cpu** 进程（**二进制边界** 以此为准）。

---

## 4. 签名与打包（已定）

- **macOS**：侧车 **Mach-O** 位于 `.app` 内资源目录；与主程序 **同一次 `codesign`（含 `--deep` 等团队既定参数）**，避免 Gatekeeper 拒绝子二进制。
- **Windows**：侧车 **`rushi-asr-sidecar.exe` / `rushi-asr-sidecar-cuda.exe` 及 onedir 内 DLL** 均须 **Authenticode** 签名（与主安装包同一证书策略）。

---

## 5. 模型缓存目录与卸载（已定）

- **统一缓存根**：`{app_data_dir}/studio.lingchuang.rushi/models/`（与现有 SQLite 同应用数据根，便于备份与诊断 zip 说明）。侧车仅可再设 **临时工作目录**（如系统 temp 或 `…/models/_work`），**不以 temp 为长期模型存放处**。
- **默认获取路径（v0.1.8+）**：**macOS DMG / Windows 安装包** 内嵌 **默认 Paraformer 三件套**（`bundled-asr-models/`）；**首次打开应用** 自动 **首启 seed** 到上述缓存根。Plan：[`asr-bundled-models-plan-v2.md`](../execution/specs/asr-bundled-models-plan-v2.md)。**不含** SenseVoice；**不含** ModelScope prepare 主路径；**不含** 路线 E 离线 zip（已撤回）。
- **发布**：安装包单文件 **< 2 GB** → GitHub Release；**≥ 2 GB** → 该平台改站外下载 + checksum。**v0.1.8 不做 OTA**（无 `app.tar.gz` updater）。
- **卸载行为**：**默认卸载安装包不删除** `…/models/`（避免误删大文件与用户曾手动缓存）；卸载向导提供 **可选勾选**：「同时删除已下载的语音识别模型（约显示占用空间）」。应用内 **设置** 提供 **「清除模型缓存」** 独立入口。

---

## 6. 版本与升级（已定）

- **侧车与桌面壳 semver 相互独立**（例如壳 `0.2.0`、侧车 `0.1.3`），在 `GET /health` 或侧车 stdout/元数据 manifest 中报告 **`rushi_asr_sidecar_version`**（实现阶段定字段名）。
- **应用升级**：安装包升级时 **顺带升级** 已随包分发的侧车二进制（CPU 与可选 CUDA 包与壳 **同次发布物料** 对齐）；模型缓存 **不因壳小版本升级而自动清空**，除非迁移脚本明确要求。

---

## 7. 失败降级与 UI（已定）

- 若 **bundled 推理侧车** 启动失败或 **health 在超时内不达标**：**回退到仅 stub**（保持现有 HTTP 契约与空文本占位行为），并在桌面 **明确 UI 提示**（不可静默），说明「推理侧车未启动 / 已回退 stub」及建议操作（重试、检查磁盘、查看诊断包等）。与现有 `GET /health` 能力字段检测衔接。

---

## 8. 预算拆分（5GB，与 §0 一致）

| 区块 | 目标上限（可随首版实测调整） | 说明 |
|------|------------------------------|------|
| 桌面壳 + 非推理资源 | ≤ 约 0.5–1.0 GB | 含用户指南等。 |
| 推理侧车（CPU 包；mac 含 MPS wheel） | ≤ 约 2.0–2.5 GB | 锁 `requirements-sidecar-cpu-*.lock`。 |
| Windows `rushi-asr-sidecar-cuda.exe` 及依赖 | **默认计入**安装介质（与 CPU 包 **一并分发**） | 与 CPU 包 **二选一运行**；磁盘 **两包并存**，不占双份常驻内存。 |
| `…/models/` 缓存 | 余量至 **5GB 总计** | 默认单模型 SKU；多模型走高级流程。 |

若实测侧车超过上表，必须修订本文件或调整 PyInstaller 范围 / 总预算。

---

## 9. 与当前仓库实现的关系

- 当前代码已有 **stub 侧车**、`GET /health` 能力字段、启动/退出钩子、**macOS / Windows CPU 侧车** PyInstaller 脚本、**内置 ffmpeg**、锁文件矩阵。  
- **Windows x64**：桌面壳已实现 **CUDA onedir 优先 + 健康检查超时回退 CPU**（`RUSHI_FORCE_BUNDLED_ASR_CPU=1` 强制 CPU）；**`npm run asr:build-sidecar-windows-cuda`**（或 `build-asr-sidecar-windows.ps1 -Variant Cuda`）生成 `rushi-asr-sidecar-cuda/`。  
- **推理 device（2026-07）**：侧车 `resolve_funasr_device()` 对齐 §3 — 未设 `RUSHI_FUNASR_DEVICE` 时 **自动** `cuda`→`mps`→`cpu`；显式 env 可强制（含 `cpu` 回退）。`GET /health` 含 `funasr_device` / `funasr_device_source`。调研：[`local-asr-gpu-and-windowing-research.md`](../execution/specs/local-asr-gpu-and-windowing-research.md)。  
- **已部分落地**：默认 **`RUSHI_FUNASR_MODEL`**、`RUSHI_MODELS_ROOT` / hub 缓存、`POST /v1/models/prepare-default`（阻塞下载 + 磁盘粗检 + `/health` 缓存探测字段）、**异步准备 + `prepare-status`**、P1 **侧车失败文案**、**重试侧车 / 打开应用数据目录 / 预先下载默认模型** 按钮、**Linux x86_64** 侧车锁与构建脚本（工程用，**不承诺**终端矩阵）、**Windows 发布检查清单**、**`scripts/sign-windows-sidecar.ps1`（递归签侧车 onedir）**、**PyInstaller collect 说明 + nightly workflow**、Vitest **health 解析** 单测、Playwright **loopback `/health`** 烟测。  
- **仍待工程化**：下载 **独立进度条 / 断点续传 UI**、**强校验 manifest**（消费版默认仍可选环境变量；内发/企业可在发布 checklist 强制）、**安装包级 Authenticode / 升级流水线** 与团队证书策略完全对齐（证书不进仓库；侧车目录递归签名见 `scripts/sign-windows-sidecar.ps1`）等。实施真源见 [`rushi-local-runtime-catalog-remediation-plan.md`](../execution/specs/rushi-local-runtime-catalog-remediation-plan.md)（R3h）。
- **引擎替代评估（跟踪）**：Phase 3 后 **Sherpa-ONNX Spike**（[`remediation-plan`](../execution/specs/rushi-local-runtime-catalog-remediation-plan.md) §5 Phase 3.5）；未通过则接受 ~2.5GB Python 侧车为长期约束并持续加固 PyInstaller。

---

## 10. Windows CUDA 包分发方式（已定）

- **默认**：安装介质 **同时附带** `rushi-asr-sidecar.exe` 与 `rushi-asr-sidecar-cuda.exe`（及各自 onedir）；**不**采用「仅检测到 N 卡后再联网下载 CUDA 包」作为默认路径（模型外置下载通道仍仅用于 **权重**，与侧车二进制分离）。

---

## 11. 桌面壳访问 loopback（排障真源，2026-05）

| 现象 | 常见根因 |
|------|----------|
| 终端 `curl http://localhost:8741/health` 成功，环境页报「无 rushi-asr 在监听」 | **侧车只 bind `127.0.0.1`**（`ASR_HOST` 默认）；`curl` 常走 IPv4，而桌面 **loopback 代理** 若连 `http://localhost` 在 macOS 上 **reqwest 可能先试 `::1`** → 连接拒绝。修复：代理 **固定连 `127.0.0.1`**（`asr_sidecar/loopback.rs`），与 `asr_setup/diagnose` 一致。 |
| `Load failed`（无 HTTP 状态码） | 开发态页面 `http://localhost:1421` 用 WebView **`fetch` 跨域访问 loopback**（PNA / 跨 host）；应用内应走 **`asr_loopback_request`**，勿依赖 WebView 直连。 |
| `ready: false` / `mode: stub` 但 `/health` 可达 | **模型未缓存**（`required_models_cached` 为 false），非连接问题；请 **一键准备** 或重启应用以重新复制内置模型。 |
| 连接失败且 `lsof -i :8741` 为空 | **侧车进程未运行**；`npm run asr:dev` 或 `npm run desktop:dev`。 |
| 磁盘有 GB 级 `models/`，`/health` 仍 `cached: false` | 侧车未设 **`RUSHI_MODELS_ROOT`**；用 `npm run asr:dev` 或 `scripts/resolve-asr-models-root.sh`。 |
| 路径真源 | Rust `app_data_paths.rs` + `scripts/resolve-asr-models-root.sh`（须与 bundle id 同步）。 |
