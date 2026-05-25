# Acceptance: R3f — 本机 ASR 一键环境准备

> **状态**：规划已定（产品决策已锁定），待实施  
> **关联**：[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)、[`r3c-local-asr-cache-manifest-acceptance.md`](./r3c-local-asr-cache-manifest-acceptance.md)、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)

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

### 不做（R3f）

- Windows 安装包用户 v1 的 **pip / embeddable Python 安装器**
- 长音频分片转写（R3e）
- 侧车下载独立进度条 / 断点续传 UI（沿用现有 prepare 进度即可）
- Linux 桌面正式侧车矩阵

### 延后（非 v1 主路径）

| 项 | 说明 |
|----|------|
| **R3f-C** | 应用数据托管 venv + 无 bundled 时自动 pip：仅 **高级** 或 dev 无侧车包时的兜底，优先级低于 R3f-B/E |

## 非功能约束

- Tauri 仅 spawn **白名单**命令（内置 exe、已有 HTTP prepare）；日志写入 `desktop.log`。
- 与 `asr-sidecar-funasr-policy.md` §0「纯小白」一致。
- 编排逻辑放 Rust + 薄 controller；`EnvLocalAsrPanel` 只做组装。

## 验收（手测）

1. **macOS 安装包**：零终端 → 一键准备 → `/health` 显示 `funasr_ready` + `funasr_default_model_cached`（首次允许联网等待）。
2. **Windows 安装包**：同上，且 CUDA 机可自动选 CUDA 包（失败回退 CPU）；全程无 PowerShell 教程。
3. **`tauri dev`（已 build sidecar）**：与安装包相同主路径，不依赖 `python -m rushi_asr` 手动启动。
4. **8741 已被外置 ASR 占用**：诊断标明冲突；用户可选使用当前服务或重试内置。
5. **磁盘不足**：准备前或失败时中文提示，不 silent stub。

## 建议实施顺序

`R3f-A` → `R3f-B` → `R3f-D` → `R3f-E` → `R3f-F`；`R3f-C` 按需后置。

**路线图建议**：R3c 手测签收 → **R3f** → R3d → R3e（或与 R3d 并行若人手允许）。

## 落位（实施时）

| 层 | 路径 |
|----|------|
| Rust | `src-tauri/src/asr_setup/`（`diagnose.rs`, `repair.rs`） |
| TS | `src/services/asr/asrSetupContract.ts`、`src/tauri/asrSetupApi.ts` |
| Controller | `useAsrSetupController.ts` 或扩展 `useAsrBridgeController.ts` |
| UI | `envLocalAsr/LocalAsrSetupWizard.tsx`、`EnvLocalAsrPanel.tsx` |
