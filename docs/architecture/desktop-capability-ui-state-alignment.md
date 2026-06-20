# 桌面端：能力字段与 UI 状态对齐

> **真源**：本文件定义「后端/侧车能力 → 前端展示」的对齐纪律。  
> **触发场景**：任何新增或扩展 ASR / 环境 / 设置类能力时 **必须先读**。  
> **路线图索引**：[`rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) §4.1.4、§4.1.1 ⑤b。

## 1. 问题定义（R3g-A 暴露）

典型失败模式：**接口已落地，但 UI 仍绑定旧的全局字段**，在用户切换维度（模型 SKU、侧车实例、安装来源）后出现：

| 用户看到 | 实际真源 | 结果 |
|----------|----------|------|
| Paraformer「未下载」 | 全局 `funasr_required_models_cached=true`（SenseVoice 就绪） | 下载区 100% /「已缓存」 |
| 已选 Paraformer | 侧车 `funasr_model_id=SenseVoiceSmall`（8741 旧进程） | 「应用」无效、侧车报告不对 |
| 旧侧车无 catalog | 下拉回退单项 + 无 `cached` 字段 | 已下载仍显示「未下载」 |

根因不是单点 bug，而是 **规划与实施缺少「状态维度假设」清单**：只验收 API，未验收 **同一面板内多控件是否引用同一维度**。

## 2. 状态维度（本机 ASR v1）

实现 UI 前必须标明每条文案/进度条属于哪一维：

| 维度 ID | 含义 | 典型来源 |
|---------|------|----------|
| **D1 用户所选** | 下拉 / localStorage / `prefs/funasr_hub_model_id.txt` | `useLocalAsrModelCatalog.selectedHubModelId` |
| **D2 侧车运行** | 8741 当前进程实际使用的 hub id | `/health.funasr_model_id` |
| **D3 侧车代际** | 是否 R3g+ catalog / force-restart 能力 | `/` 的 `model_catalog` 或 `/health.local_asr_model_catalog` |
| **D4 按 SKU 缓存** | 某一 hub 模型是否完整落盘 | `/v1/models/catalog` 或 `buildLocalAsrCatalogView` |
| **D5 侧车全局就绪** | ffmpeg + funasr 导入 + **当前 D2** 所需权重 | `/health.ready_for_transcribe` |
| **D6 默认 SKU 缓存** | 仅 SenseVoice 默认包 | `/health.funasr_default_model_cached` |
| **D7 制品忙态 overlay** | 模型下载 / LRC 安装进行中，须压制 D5「可转写」与 wizard 完成态 | `prepareModelBusy` / `runtimeInstallRunning` → `buildAsrEnvPresentation` overlay |

**硬规则**

1. **D1 ≠ D2 时**：禁止用 D5/D6 表示「当前所选模型可转写」；必须提示「应用并重启侧车」。
2. **D4 按 hub 展示**：禁止用 D5/D6 驱动「当前所选模型」的进度条/百分比。
3. **D3 过期**：禁止静默隐藏；须提示 stale 侧车或引导 force-restart（见 `asr_sidecar::force_restart_bundled`）。
4. **同一 section 内** 所有行（下拉、列表、进度、按钮文案）必须同一 D1 或明确标注 D2（「侧车运行中」）。

### 2.1 多引擎扩展（R3s-A，Phase 2 实现 UI）

> Phase 1 仅文档预留；**禁止**用 D2/D5 表示 Sherpa ONNX SKU 状态。

| 维度 ID | 含义 | FunASR 侧车 | Sherpa ONNX（目标默认） |
|---------|------|-------------|-------------------------|
| **E1 引擎选择** | 用户所选引擎 + SKU | `local_asr_engine=funasr-sidecar` + hub pref | `local_asr_engine=sherpa-onnx` + `qwen3-asr-vad-0.6b` |
| **E2 权重就绪** | 当前 E1 所需文件落盘 | D4 hub 缓存 + D5 | LRC `RuntimeModelArtifact` + `files_required` |
| **E3 运行时** | 转写执行载体 | 8741 `/health` | 进程内 ORT；**不占用 8741** |

**硬规则（Sherpa）**

1. E1=Sherpa 时：禁止展示「侧车模型不一致」「应用并重启侧车」等 FunASR 文案。  
2. E2：禁止用 `/health.ready_for_transcribe` 表示 Qwen ONNX 就绪。  
3. E3：环境页「可直接转写」须走 `sherpa_asr_diagnose` 或等价 Rust 真源。

实现计划：[r3s-sherpa-qwen3-default-engine-implementation-plan.md](../execution/specs/r3s-sherpa-qwen3-default-engine-implementation-plan.md)

## 3. 推荐实现模式

### 3.1 纯函数派生（TS）

- 目录常量：`apps/desktop/src/services/asr/localAsrModelCatalog.ts`
- 合并视图：`buildLocalAsrCatalogView(caps, serverCatalog, selectedHubId)`
- 所选模型下载/转写态：`selectedModelPrepareState(view, selectedHubId, sidecarHubId)`

**禁止**在组件内直接读 `asrCaps.funasr_required_models_cached` 表示「所选模型已缓存」。

### 3.2 侧车生命周期（Rust）

- 写 pref / 切换模型 → `force_restart_bundled`（杀 8741 监听者 + 启新进程）
- 启动时 stale 检测 → 无 `model_catalog` 则自动 refresh
- 「8741 已 healthy 则 skip」**不足以**完成模型切换

### 3.3 Spec 必带：能力—UI 状态矩阵

中等及以上功能在 **acceptance.md** 增加表格（见 [`spec-template.md`](../execution/specs/spec-template.md) §能力—UI 状态矩阵）。

## 4. R3 存量疏漏台账（2026-05-27 代码对照刷新）

| 优先级 | 落位 | 问题 | 维度误用 | 状态 |
|--------|------|------|----------|------|
| P0 | `EnvLocalAsrPanel` 模型下载区 | 进度/文案绑 D1+D4 | 曾用 D5 | ✅ **R3g-A1** |
| P0 | `LocalAsrModelSection` | mismatch、侧车报告 | D1 vs D2 | ✅ |
| P0 | `asr_sidecar.rs` | `force_restart_bundled` | D3 | ✅ |
| P0 | **模型下载取消** | `POST /v1/models/prepare-cancel` + `phase: cancelled` | cooperative；单文件中途不可硬停 | ✅ 编码；⑤c **手测** |
| P1 | `EnvLocalAsrPanel`「可直接转写」 | `computeLocalAsrTranscribeReady` | 曾用裸 D5 | ✅ **编码**；待 S3 手测 |
| P1 | `WelcomeTopBar` / `ProjectHeader` | 同上 | 同上 | ✅ **编码**；待 S3 |
| P1 | `LocalAsrGuidanceSection` | 组件 **未引用**（死代码） | 若接回须 D1 | 📋 删除或 **R3d** 再接 |
| P1 | `useAsrSetupHealthFlow` / `localAsrSetupModelStep` | 跟 D1 + `prepare(model_id)` | 曾 D5 | ✅ **编码** |
| P2 | `useAsrSetupController` 摘要 | 「默认模型」措辞 | D1 | **R3f** |
| P2 | 顶栏 vs 环境面板 | 两套 ASR 状态 | **R3d** | **R3h-3** ✅ 顶栏芯片与左导航点共用 presentation；内容区不重复总览 |

**R3g-A 签收门槛**：P0 全绿（含 **真取消** Q-R3g-3）+ **S3** 2 组手测 + Paraformer 13min（⑤c）。

## 5. 验证清单（每轮 ASR/环境 UI 必做）

1. **矩阵手测**：至少 2 组（SenseVoice 已缓存 / Paraformer 未缓存且已选）走同一面板，截图无矛盾句。
2. **侧车切换**：应用后 `curl /health | grep funasr_model_id` 与 D1 一致。
3. **Stale 侧车**：旧进程占 8741 → UI 有提示；force-restart 后 D3 catalog 200。
4. **自动化**：`localAsrModelCatalog.test.ts` 覆盖 `selectedModelPrepareState` mismatch；Rust `force_restart` 单测。
5. **回归**：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`。

## 6. 与其它文档关系

- 侧车策略：[`asr-sidecar-funasr-policy.md`](./asr-sidecar-funasr-policy.md)
- R3g 验收：[`r3g-local-asr-model-catalog-acceptance.md`](../execution/specs/r3g-local-asr-model-catalog-acceptance.md)
- Setup 状态机（远期）：路线图 **R3h-I3**
