# Acceptance: R3f — 本机 ASR 一键环境准备

> **状态**：R3f-A/B/D/F 已编码并补强自动化对照；`bundled` 主路径、`8741` 冲突接受当前服务、主 UI 隐藏 `pip` 入口均已有回归覆盖。**仍待安装包手测**（macOS / Windows，建议在 R3h-0 / R3h-1 全绿后签收）。  
> **关联**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md)（发行整改真源）、[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)、[`r3c-local-asr-cache-manifest-acceptance.md`](./r3c-local-asr-cache-manifest-acceptance.md)、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)

## 产品决策（已锁定）

| # | 议题 | 决策 |
|---|------|------|
| 1 | **开发版（`tauri dev`）默认路径** | **选项 B**：与安装包一致，**优先内置 bundled 侧车**（`retry` → health → `prepare-default`）。仅当资源目录无侧车产物时，再降级「高级」路径（托管 venv / 文档），**不**作为主按钮。 |
| 2 | **Windows 终端用户 v1** | **仅内置双 exe**（`rushi-asr-sidecar.exe` + `rushi-asr-sidecar-cuda.exe`），应用内下模型；**v1 不对安装包用户执行 pip/选仓库**。 |

推论：

- 「缺什么装什么」对**终端用户**= 拉起/修复侧车 + 预下载模型 + 磁盘/端口诊断，**不是**教用户开终端。
- `install_funasr_deps_interactive`（选仓库 + bash）降级为**高级/开发者兜底**，不作为主流程。
- 改 `rushi_asr` Python 后，开发者需 **重打侧车**（`npm run asr:build-sidecar-*`）才能在 dev 里验证，与选项 B 一致。

## 目标

非技术用户打开「环境与 ASR」后，点 **「一键准备本机 ASR」**：

1. 自动诊断当前环境（侧车、FFmpeg、FunASR、模型缓存、8741 冲突、磁盘）。
2. 按白名单步骤后台执行，**无需用户输入 shell 命令**。
3. 展示步骤进度与中文结果；失败可重试、打开应用数据、导出诊断。

## 范围

### 做（按切片）

| 切片 | 内容 |
|------|------|
| **R3f-A** | `AsrSetupReport` 诊断契约 + UI 驱动引导步骤 |
| **R3f-B** | 编排：`retry_bundled` → health 轮询 → `prepare-default`（async）；主按钮「一键准备」 |
| **R3f-D** | 8741 冲突检测：外置 ASR / 占用说明；「使用当前服务」vs「重试内置侧车」 |
| **R3f-E** | Windows：CUDA/CPU 二选一拉起 + 错误文案 + 手测（**不 pip**） |
| **R3f-F** | 首次拉取语段前轻提示；「复制手动命令」收进高级 |

### 不做（R3f 本切片）

- 长音频分片转写（R3e）
- Linux 桌面正式侧车矩阵

### 迁至 R3h（发行整改，见 remediation plan）

| 原 R3f 范围 | R3h 阶段 |
|-------------|----------|
| 应用内下载/安装侧车、完整性诊断、损坏重下 | R3h-1 / R3h-2 |
| 侧车下载进度条 / 断点续传 | R3h-2 |
| Windows v1 仍 **不** 对终端用户 pip；联网下 **侧车 zip** 与模型权重分离 | R3h-1 + policy §10 |

### 延后（高级 / 非主路径）

| 项 | 说明 |
|----|------|
| **R3h-E**（原 R3f-C） | 应用数据托管 venv + 白名单 pip：仅 **高级** 兜底 |
| **R3h-F** | 应用内跑 `build-asr-sidecar-*`：仅开发者折叠入口 |

## 非功能约束

- Tauri 仅 spawn **白名单**命令（内置 exe、已有 HTTP prepare）；日志写入 `desktop.log`。
- 与 `asr-sidecar-funasr-policy.md` §0「纯小白」一致。
- 编排逻辑放 Rust + 薄 controller；`EnvLocalAsrPanel` 只做组装。

## 验收（手测）

1. **macOS 安装包**：零终端 → 一键准备 → `/health` 显示 `funasr_ready` + `funasr_default_model_cached`（首次允许联网等待）。
2. **Windows 安装包**：同上，且 CUDA 机可自动选 CUDA 包（失败回退 CPU）；全程无 PowerShell 教程。
3. **`tauri dev`（已 build sidecar）**：与安装包相同主路径，不依赖 `python -m rushi_asr` 手动启动。
4. **8741 已被外置 ASR 占用**：诊断标明冲突；用户可选使用当前服务或重试内置。
5. **磁盘不足**：准备前或失败时中文提示，不 silent stub；**Windows** 亦能通过诊断得到磁盘预警（R3h-0）。
6. **主 UI 无 pip 教程**：`install_funasr_deps_interactive` 仅出现在高级/开发者折叠区（R3h-0）。

## 2026-05-27 对照结论

- **已由代码/自动化覆盖支撑**：
  - `R3f-B`：`bundled` 可用但 `/health` 未就绪时，会走 `retry_bundled` → health 轮询 → ready；已补 `useAsrSetupController.test.ts` 回归。
  - `R3f-D`：`8741` 被外置 `rushi-asr` 占用时，可选择“使用当前服务”；已补 ready / blocked 两条控制器回归。
  - `R3f-F`：`pip` 与手动命令仅位于“高级 / 开发者”折叠区；已补 `LocalAsrAdvancedSection.test.tsx`。
  - `R3h` 联动项：当内置侧车缺失或损坏时，主路径会转向 `local_runtime` 下载 / 修复，不再要求用户手动开终端。
- **已由实现对照确认但未做本轮实机手测**：
  - Windows `CUDA/CPU` 侧车自动选择逻辑已在 `asr_sidecar.rs` 中实现；仍需 Windows 安装包手测确认真实驱动探测与回退文案。
  - 磁盘预警与中文 blocking 文案已在 `asr_setup/diagnose.rs` 与一键准备控制器中接通；仍建议在安装包场景做一次低磁盘手测。
- **仍待签收的手测项**：
  - macOS 安装包零终端首装到 ready。
  - Windows 安装包零终端首装、CUDA 失败回退 CPU、全程无 PowerShell / pip 教程。

## 建议实施顺序

`R3f-A` → `R3f-B` → `R3f-D` → `R3f-E` → `R3f-F`；`R3f-C` 按需后置。

**路线图建议（§4.1 真源）**：R3f 手测签收 → **R3e-A** → **R3g-A** → R3d 轻量 → **R3e-B**。

## 落位（实施时）

| 层 | 路径 |
|----|------|
| Rust | `src-tauri/src/asr_setup/`（`diagnose.rs`, `repair.rs`） |
| TS | `src/services/asr/asrSetupContract.ts`、`src/tauri/asrSetupApi.ts` |
| Controller | `useAsrSetupController.ts` 或扩展 `useAsrBridgeController.ts` |
| UI | `envLocalAsr/LocalAsrSetupWizard.tsx`、`EnvLocalAsrPanel.tsx` |
