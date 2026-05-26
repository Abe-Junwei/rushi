# 审查报告：rushi-local-runtime-catalog-remediation-plan.md

> **审查日期**：2026-05-26  
> **状态**：**已吸收** → [`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) **v1.1**（§13 对照表）  
> **审查范围**： remediation-plan 方案完整性、竞品对标、代码缺口、技术路线风险评估  
> **数据来源**：代码审查（asr_sidecar.rs / diagnose.rs / UI 组件 / 构建脚本）、ASR/LLM 桌面应用竞品调研（15+ 产品）、技术替代方案评估（Sherpa-ONNX / faster-whisper / whisper.cpp 等）

---

## 1. 执行摘要

| 维度 | 评估结论 | 等级 |
|------|----------|------|
| **方案完整性** | 5 阶段规划清晰，概念模型（LRC）正确，验收标准明确 | ✅ **良好** |
| **竞品对标** | 与 Ollama / LM Studio / Jan 等行业最佳实践基本一致 | ✅ **对齐** |
| **代码缺口映射** | Phase 0–1 与当前代码缺口精准对应，可执行性强 | ✅ **精准** |
| **技术路线风险** | FunASR + PyInstaller 是当前可行路径，但 ~2.5GB 侧车体积是长期隐患 | ⚠️ **需中期重估** |
| **遗漏项** | 未评估 Sherpa-ONNX 消除 Python 侧车的可能性；Windows 磁盘检查缺失未在 plan 中体现 | ⚠️ **有遗漏** |
| **实施建议** | **按 Phase 0→1→2 顺序推进**，Phase 3 后立项评估 Sherpa-ONNX 替代 | 🟡 **有条件通过** |

**核心判断**：该 remediation plan 作为 R3h 的整改真源是**合格且可执行的**，但在 Phase 4（本机 LLM）之前应增加一个**引擎替代评估门控**，避免 ~2.5GB Python 侧车成为长期技术债。

---

## 2. 方案完整性审查

### 2.1 已覆盖（优秀）

| 项 | 评价 |
|----|------|
| 7 种竞品模式归纳（§2.1） | 覆盖 Ollama、LM Studio、Jan、GPT4All、Parlotype、WhisperDesk、FunASR SDK、LocalAI、pip | ✅ |
| 4 项明确不采纳决策（§2.3） | PyInstaller 应用内打包、LocalAI 嵌入、Ollama 替代 ASR、Docker 桌面默认 | ✅ |
| LRC 概念模型 + 组件类型定义（§3） | `asr-sidecar` / `asr-model` / `llm-runtime` / `llm-model` 四类，清晰 | ✅ |
| Manifest 契约设计（§3.4） | sha256 必检、原子安装、分层、内容寻址；借鉴 Ollama 合理 | ✅ |
| 就绪状态机扩展（§3.5） | `sidecar.source` / `integrity` / `version` 三态；禁止仅凭 exe 存在报 installed | ✅ |
| 用户流程 + 排错白名单（§4） | 主路径、排错动作、在线 STT/云 LLM 共享外壳，完整 | ✅ |
| 5 阶段分阶段实施（§5） | Phase 0–5 粒度适中，验收条件明确 | ✅ |
| 与现有 R3 薄片关系（§6） | 与 R3f/R3g/R3e 的排期依赖清晰 | ✅ |
| 安全/磁盘/签名非功能需求（§7） | 预算拆分、Authenticode、Apple 同签、路径限制 | ✅ |
| 风险与缓解（§10） | CDN 运维、下载失败、范围膨胀、双份磁盘 | ✅ |
| 验收总表（§11） | 7 条发行门禁，可勾选 | ✅ |
| 三类模型对照附录（§12） | 防止团队概念混淆，实用 | ✅ |

### 2.2 缺失或不足

| # | 缺失项 | 影响 | 建议 |
|---|--------|------|------|
| **M1** | **未评估 Sherpa-ONNX 替代 Python 侧车** | ~2.5GB → ~300MB，可彻底消除 PyInstaller 构建/签名/分发复杂性 | Phase 3 后增加 Spike（见 §5） |
| **M2** | **Windows 磁盘空间检查缺失** | 当前 `disk_free_bytes` 仅在 Unix 实现；Windows 用户无磁盘预警 | 纳入 Phase 0 或 R3f 修复 |
| **M3** | **侧车版本升级策略细节不足** | manifest `min_shell_version` 仅提及，无具体升级/回滚流程 | Phase 2 补充升级原子化设计 |
| **M4** | **侧车多实例/并发启动边界** | 若用户快速点击两次「一键准备」，spawn 是否去重？ | Phase 1 增加 installer 状态机（idle / downloading / installing / ready） |
| **M5** | **离线安装包体积上限** | 侧车 ~2.5GB + 安装包其他内容可能接近 3GB，部分 CDN/商店有单文件限制 | 补充分卷/分包策略（如 `.zip.001`） |
| **M6** | **侧车健康探测超时策略** | 当前 20 秒固定超时；冷启动 PyInstaller onedir 在 HDD 上可能需要更久 | 建议区分 SSD/HDD 自适应超时或允许用户重试 |

---

## 3. 竞品与行业实践对标

### 3.1 调研覆盖范围

| 类别 | 调研产品数 | 代表产品 |
|------|-----------|----------|
| **LLM 桌面应用** | 6 | Ollama、LM Studio、Jan、GPT4All、AnythingLLM、Msty |
| **ASR 桌面应用** | 10+ | MacWhisper、WhisperDesktop、Buzz、Aiko、SuperWhisper、aTrain、Vox、AudioX、MumbleFlow、TypeWhisper 等 |
| **Tauri + Rust ASR 应用** | 3 | Vox、AudioX、MumbleFlow |
| **技术替代方案** | 4 | faster-whisper、whisper.cpp + whisper-rs、Sherpa-ONNX、PyInstaller 替代 |

### 3.2 关键发现与 plan 对齐度

#### ✅ 高度一致（Plan 正确）

| 行业实践 | 来源产品 | Remediation Plan 对应 |
|----------|----------|----------------------|
| **运行时与模型分离** | Ollama、LM Studio、Jan 全部如此 | §3.1 LRC 概念模型：sidecar 与 model 分开 manifest 条目 |
| **OCI/Manifest + Blob 分层** | Ollama（130K+ stars，事实标准） | §3.4 manifest 契约：sha256 内容寻址、分层复用、原子安装 |
| **安装包内嵌运行时 + 权重按需下载** | LM Studio、Jan、GPT4All | §3.3 解析顺序：bundled 回退 + 应用数据下载 |
| **应用内 Setup Wizard** | Msty、Vox、AudioX、WhisperKey | §4.1 主路径：诊断 → 引导 → 下载 → 安装 → 测试 |
| **运行时自动更新** | LM Studio (`lms runtime update`) | §7.3 壳升级不强制清 models；侧车按 `min_shell_version` 提示升级 |
| **Local by default，云端可选** | AnythingLLM、Jan | §4.3 在线 STT/云 LLM 共享 Readiness 外壳 |
| **多后端统一抽象** | Msty（Ollama/MLX/llama.cpp） | §3.2 组件类型：`llm-runtime` + `llm-model` 与 ASR 并列 |

#### ⚠️ 可补充借鉴（Plan 未充分吸收）

| 行业实践 | 来源 | 对 Rushi 的启示 | 建议纳入阶段 |
|----------|------|----------------|-------------|
| **Tauri sidecar 内嵌 whisper-cli + ffmpeg** | AudioX（GitHub 开源） | Rushi 当前侧车是 PyInstaller onedir；AudioX 的 `src-tauri/binaries/` 结构更轻量 | Phase 0 参考其构建脚本 |
| **首次启动自动下载模型（onboarding wizard）** | WhisperKey、Vox、AudioX、StarWhisper | 当前 plan 侧重「侧车下载」，模型下载仍为侧车 `prepare`；可统一为 installer 管理 | Phase 2 |
| **模型元数据展示（RAM/磁盘/参数量/量化）** | GPT4All、Jan | R3g catalog 可补充硬件需求阈值，避免用户下载后无法运行 | R3g-A |
| **Persistent worker 保持模型常驻** | StarWhisper | 避免每次转写重新加载模型；当前 plan 未涉及侧车保活策略 | Phase 3 后评估 |
| **压缩分发（.7z）** | AnythingLLM | 侧车 zip 可进一步压缩，减少下载流量 | Phase 1 可选 |

#### ❌ 已正确排除（Plan 决策正确）

| 方案 | 排除原因 | 竞品验证 |
|------|----------|----------|
| 嵌入 LocalAI | 体积大、矩阵爆炸、与 FunASR 双栈 | LocalAI 桌面版 > 5GB，不符合 5GB 预算 |
| Ollama 替代 ASR 侧车 | ASR 栈不同（GGUF vs PyTorch） | Ollama 不支持 FunASR/Paraformer/SenseVoice |
| 应用内 PyInstaller 打包 | 慢、难签名、磁盘翻倍 | 无成熟产品采用此模式 |
| FunASR Docker 桌面默认 | 依赖 Docker、非纯小白 | 所有成熟桌面 ASR 产品均避免 Docker |

### 3.3 Tauri + Rust ASR 应用特别对标

| 产品 | 技术栈 | 体积 | 模型管理 | 与 Rushi 的相似度 |
|------|--------|------|----------|------------------|
| **Vox** | Tauri 2 + Rust + whisper.cpp | ~8MB 壳 | 首次手动下载 small 模型 | ⭐⭐⭐ 高 |
| **AudioX** | Tauri 2 + Rust + SolidJS + SQLite | ~8MB 壳 | Setup Wizard 自动下载 ggml-base | ⭐⭐⭐ 高 |
| **MumbleFlow** | Tauri 2 + Rust + whisper.cpp + llama.cpp | ~8MB 壳 | Bundle 内含模型，无需用户管理 | ⭐⭐⭐ 高 |
| **Rushi（当前）** | Tauri + Rust + PyInstaller FunASR | ~2.5GB 侧车 | 侧车 `prepare` 下载 | ⭐⭐ 中（侧车过重） |

**关键洞察**：与 Rushi 技术栈最相似的 3 个 Tauri ASR 应用（Vox、AudioX、MumbleFlow）均使用 **whisper.cpp 原生侧车**（体积 < 10MB），而非 Python 运行时。这是 Rushi 长期需正视的架构差异。

---

## 4. 当前代码缺口与 Plan 映射

### 4.1 精准命中（Plan → 代码缺口 一一对应）

| Plan 阶段 | 整改要求 | 代码现状 | 缺口验证 |
|-----------|----------|----------|----------|
| **Phase 0** | `--collect-data funasr` | `build-asr-sidecar-unix.sh` 仅 `--collect-submodules` | ✅ 已确认事故 |
| **Phase 0** | Post-build smoke | 无 smoke 脚本，无 nightly workflow 门禁 | ✅ 缺口存在 |
| **Phase 0** | `sidecarIntegrity: corrupt` | `bundled_available` 仅 bool，无 corrupt 态 | ✅ 缺口存在 |
| **Phase 1** | `local_runtime/` 模块 | 无 LRC 核心代码 | ✅ 缺口存在 |
| **Phase 1** | 优先 app_data 侧车 | `resolve_sidecar_executable()` 仅读 bundled | ✅ 缺口存在 |
| **Phase 1** | 下载进度 UI | `LocalAsrSetupWizard` 无下载器 UI | ✅ 缺口存在 |
| **Phase 2** | 一键准备自动下载侧车 | `runOneClickAsrPrepare` 只能 retry bundled | ✅ 缺口存在 |
| **Phase 2** | 断点续传 | 无下载器基础设施 | ✅ 缺口存在 |

### 4.2 Plan 未覆盖的现有代码问题

| # | 问题 | 代码位置 | 建议处理 |
|---|------|----------|----------|
| **C1** | Windows 磁盘空间检查缺失 | `asr_setup/diagnose.rs` `#[cfg(not(unix))]` 返回 `None` | **R3f 或 Phase 0 修复**；Windows 可用 `GetDiskFreeSpaceExW` |
| **C2** | 旧 pip 安装路径未彻底降级 | `lib.rs` 仍注册 `install_funasr_deps_interactive`；UI 仍展示 pip 命令 | **R3f-F 或 Phase 1 彻底移除**主路径展示，仅留高级折叠入口 |
| **C3** | `useProjectLifecycleController` 381 行 / 21 hooks | `apps/desktop/src/pages/useProjectLifecycleController.ts` | R0 已规划拆分，但与 LRC 无直接关联 |

---

## 5. 技术路线评估：FunASR 侧车 vs 替代方案

### 5.1 评估结论速览

| 方案 | 中文效果 | 体积 | Tauri 契合 | 迁移成本 | 建议 |
|------|---------|------|-----------|----------|------|
| **保持 FunASR + PyInstaller** | ⭐⭐⭐ 优秀 | ~2.5GB | ⭐⭐ 中（HTTP 侧车） | — | **Phase 0–2 继续** |
| **faster-whisper / CTranslate2** | ⭐ 差（CER 高 2–10x） | ~2GB | ⭐⭐ 中（仍需 Python） | 高 | **不采纳** |
| **whisper.cpp + whisper-rs** | ⭐⭐ 一般（不支持 SenseVoice） | ~3GB | ⭐⭐⭐ 完美（Rust FFI） | 极高 | **不采纳** |
| **Sherpa-ONNX + sherpa-rs** | ⭐⭐⭐ 同模型（ONNX < 1% 损失） | ~300MB | ⭐⭐⭐ 完美（官方 crate） | 中（2–4 周） | **Phase 3 后 Spike** |
| **PyInstaller → cx_Freeze** | ⭐⭐⭐ | ~2GB | ⭐⭐ 中 | 低–中 | **暂不优先** |

### 5.2 关键发现：Sherpa-ONNX

**这是唯一能让 Rushi 彻底摆脱 Python 侧车、同时保持中文精度和 SenseVoice 生态的路径。**

| 维度 | 详情 |
|------|------|
| **模型支持** | SenseVoice ✓、Paraformer ✓、Fun-ASR-Nano ✓、Qwen3-ASR ✓、Whisper ✓ |
| **Rust 集成** | 官方 `sherpa-onnx` crate，支持静态链接；已有**官方 Tauri demo** |
| **体积** | ONNX Runtime + 模型：~100–300MB（vs 当前 ~2.5GB） |
| **硬件** | CPU ✓、CUDA ✓、DirectML ✓、CoreML ✓ |
| **效果** | ONNX 导出自同一 PyTorch 权重，CER 差异 < 1% |
| **迁移成本** | Rust 后端中（~2–3 周）：替换 `asr_sidecar.rs` 为直接 `sherpa_onnx::OfflineRecognizer`；音频 pipeline 从 HTTP 改为内存传递 |
| **风险** | ONNX Runtime 跨平台静态链接在 Windows 偶有陷阱；需验证 CoreML provider 稳定性 |

### 5.3 对 Remediation Plan 的影响

**不改当前 plan 的 Phase 0–2**，原因：
1. LRC（Local Runtime Catalog）分发架构是**引擎无关**的：manifest + installer + integrity 无论侧车是 Python onedir 还是 Sherpa-ONNX 二进制都适用。
2. Phase 0–2 的核心价值是**修复当前发行阻断问题**（构建 smoke、应用内下载、损坏恢复），不应被引擎替换阻塞。
3. Sherpa-ONNX 需要 **2–4 周 Spike + 验证**，不应在 R3 时间窗口内仓促决定。

**建议在 Phase 3（统一环境与能力就绪）后增加**：

```
Phase 3.5 — 引擎评估门控（1 周 Spike）
- 用 sherpa-onnx crate + SenseVoice int8 跑通 AISHELL 样本
- 验证 macOS CoreML / Windows CUDA provider
- 与原 FunASR 侧车做 CER 对比
- 若通过：新增 asr_engine 配置项（"funasr-sidecar" | "sherpa-onnx"）
```

---

## 6. 风险重评估

### 6.1 Plan 已列风险（状态更新）

| 风险 | Plan 缓解 | 审查补充 |
|------|----------|----------|
| CDN/Release 运维成本 | GitHub Releases + manifest 单文件 | ✅ 可行；注意 GitHub Releases 单文件 2GB 限制（侧车 zip 可能接近） |
| 下载失败率高 | Phase 2 断点续传 | ⚠️ 2.5GB 文件即使有断点续传，弱网环境仍易失败；建议增加**镜像源/多 CDN 回退** |
| 与 R3e-B 同改侧车 | 排期串行 | ✅ 正确 |
| 本机 LLM 范围膨胀 | Phase 4 独立 acceptance | ✅ 正确 |
| 双份侧车占磁盘 | UI 提示 + 允许删 app_data 版 | ✅ 正确 |

### 6.2 新增风险

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| **R1** | **~2.5GB 侧车成为长期技术债** | 高 | Phase 3.5 评估 Sherpa-ONNX；若放弃则接受体积上限 |
| **R2** | **PyInstaller onedir 启动慢（HDD 上 10–30s）** | 中 | Phase 1 侧车保活（常驻进程）或 Phase 3.5 换引擎 |
| **R3** | **GitHub Releases 单文件 2GB 限制** | 中 | 侧车 zip 压缩后可能 < 2GB；若超则分卷或使用对象存储 |
| **R4** | **Windows Defender / macOS Gatekeeper 对下载二进制拦截** | 中 | manifest 中增加签名哈希校验 + UI 明确提示「来自 Rushi 官方发布管道」 |
| **R5** | **侧车与模型版本矩阵爆炸**（侧车 v0.1.3 × 模型 v1/v2 × 平台 × CUDA/CPU） | 低 | `min_shell_version` + 壳侧车同版本发布；模型向后兼容由 FunASR 保证 |

---

## 7. 实施建议（修订版路线图）

### 7.1 不变的部分（按原计划推进）

```text
R3h-0 (构建+smoke) → R3h-1 (下载安装) → R3f 手测签收 → R3e-A → R3g-A → R3h-2/3 → R3d → R3e-B
```

- **Phase 0（R3h-0）**：立即修复 `--collect-data funasr` + 新增 post-build smoke（最高优先级，阻塞所有发行）
- **Phase 1（R3h-1）**：`local_runtime/` 模块 + manifest 下载 + app_data 优先解析
- **Phase 2（R3h-2）**：与 R3f/R3g 合并 + 断点续传

### 7.2 新增/调整

| 时机 | 动作 | 理由 |
|------|------|------|
| **Phase 0 内** | 修复 Windows `disk_free_bytes`（`GetDiskFreeSpaceExW`） | 当前代码缺口，影响 Win 用户磁盘预警 |
| **Phase 0 内** | 彻底降级 `install_funasr_deps_interactive`：从主 UI 移除 pip 命令展示，收进高级折叠 | 与 plan「应用内 pip 不作为主路径」对齐 |
| **Phase 1 内** | Installer 状态机：`idle / downloading / installing / ready / error` | 防止用户并发点击、支持取消 |
| **Phase 3 后** | **新增 Phase 3.5**：Sherpa-ONNX Spike（1 周） | 评估是否值得中期替换引擎 |
| **R3g-A** | 模型 catalog 补充硬件需求阈值（RAM/磁盘/量化） | 借鉴 GPT4All/Jan |
| **R9 REL-1** | 发行门禁增加：零终端侧车安装路径手测（plan 已有）+ 弱网/断网恢复手测 | 补充极端场景 |

### 7.3 长期技术雷达

| 技术 | 跟踪理由 | 决策时点 |
|------|----------|----------|
| **Sherpa-ONNX** | 唯一消除 Python 侧车、保持中文精度的路径 | Phase 3.5（~2026-07） |
| **ONNX Runtime CoreML/DirectML** | 若 Sherpa-ONNX 通过，需验证 Apple/Windows GPU 加速稳定性 | Spike 期间 |
| **Ollama 的 OCI 协议** | 若未来模型分发规模扩大，可完全兼容 Ollama 的 manifest/blob 格式 | Phase 4 后 |
| **Whisper.cpp large-v3-turbo** | 若未来需要纯离线英文转录，可作为第二引擎 | 远期 |

---

## 8. 文档修订建议

### 8.1 建议立即修订

| 文档 | 修订要点 |
|------|----------|
| **`rushi-local-runtime-catalog-remediation-plan.md`** | §5 增加 Phase 3.5（Sherpa-ONNX Spike）；§7 增加 Windows 磁盘检查修复；§10 增加 R1–R5 新增风险 |
| **`r3f-asr-setup-wizard-acceptance.md`** | 验收增加「Windows 磁盘预警」勾选；明确 `install_funasr_deps_interactive` 降级为高级入口 |
| **`asr-sidecar-funasr-policy.md`** | §9「仍待工程化」增加「侧车替代方案评估」跟踪项 |

### 8.2 建议新增

| 文档 | 内容 |
|------|------|
| **`docs/adr/00xx-local-runtime-catalog.md`** | 记录「不嵌入 Ollama/LocalAI 为 ASR」决策（plan §9 已建议） |
| **`docs/adr/00xx-sherpa-onnx-evaluation.md`** | Phase 3.5 后记录评估结论 |

---

## 9. 总体结论

`rushi-local-runtime-catalog-remediation-plan.md` 是一份**架构清晰、竞品对标到位、实施路径可行**的整改方案。其核心设计——LRC（Local Runtime Catalog）分层组件目录 + manifest 内容寻址分发 + 统一就绪状态机——与 Ollama、LM Studio、Jan 等行业标杆的逻辑一致，且精准对应了当前代码的关键缺口。

**最大优势**：
- Phase 0 的构建 smoke 直接对应已知生产事故（`funasr/version.txt` 缺失），优先级正确。
- 明确区分「运行时侧车」与「模型权重」，避免了用户概念混淆。
- 5 阶段粒度适中，每阶段有明确验收条件，适合单人 2–4h 轮次执行。

**最大隐患**：
- **~2.5GB Python 侧车**在 Tauri + Rust 生态中属于异常重量（同类应用 Vox/AudioX 侧车 < 10MB）。PyInstaller onedir 的启动慢、签名繁琐、构建脆弱性是长期技术债。
- **Sherpa-ONNX 是目前唯一兼顾「消除 Python」+「保持中文精度」+「SenseVoice 兼容」的替代方案**，值得在 Phase 3 后投入 1 周做可行性验证。

**最终建议**：**批准按 Phase 0→1→2→3 推进**，在 Phase 3 验收后增加 Sherpa-ONNX Spike 门控。若 Spike 通过，可将引擎替换纳入 R4–R5 之间的穿插任务；若放弃替换，则需在 policy 中明确接受 ~2.5GB 侧车为长期约束，并持续优化 PyInstaller 构建稳定性。

---

*审查人：Kimi Code CLI*  
*审查日期：2026-05-26*  
*关联文档：remediation-plan.md（v1.0 · 2026-05-26）、asr-sidecar-funasr-policy.md、r3f-asr-setup-wizard-acceptance.md、rushi-execution-roadmap.md*
