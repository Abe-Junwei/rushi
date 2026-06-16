# Rushi 全量代码审查与核心模块架构对比报告

> **状态**：审查定稿（2026-06-16，同日修订优先级与 Phase 分片）  
> **范围**：`apps/desktop/src/`（React/TS）、`apps/desktop/src-tauri/src/`（Rust）、`services/asr/rushi_asr/`（Python）  
> **目的**：识别 Rushi 与业内成熟方案的架构差距，输出可执行的改进建议与优先级，不直接实施重构。  
> **前置调研**：本文档自身已包含完整的「问题陈述 → 业内路线 → 可复用评估 → 决策摘要」门禁内容。原独立调研 brief 见 [`full-code-review-architecture-comparison-research.md`](./full-code-review-architecture-comparison-research.md)（现已转为精简索引）。

---

## 1. 执行摘要

Rushi 是一个功能完整的本地中文音频转写与校对桌面应用，采用 **Tauri 2 + React 19 + SQLite + Python FunASR 侧车** 的技术栈。本次全量代码审查覆盖了约 **87.6k 行 TypeScript/React**、**32.7k 行 Rust**、**3.4k 行 Python ASR** 源码，以及对应的测试与 CI 配置。

**总体判断**：
- Rushi 的架构在「垂直切片交付」上非常成功：Controller/Service/Tauri 命令分层清晰，Notion Zen 视觉约定落地严格，测试密度高于多数同类单人项目。
- 主要架构债务集中在 **Rust 同步 IO 阻塞**、**前端状态管理过度依赖 hook 组合**、**ASR 侧车并发与资源模型**、以及 **测试覆盖率/E2E 深度不足**。
- 未发现颠覆性架构错误；改进应走「最小侵入 + 逐项清偿」路线，而非重写。

**最高优先级建议**（详见 §9）：
1. 🔴 波形引擎：修复 `peakCacheGeneration` 变化导致 WaveSurfer 整实例 remount 的问题（P0，0.5–1 天）。
2. 🔴 Rust 后端：分 Phase 引入 `r2d2-sqlite` 连接池 + WAL，优先 3 个重 IO 命令改 `async` + `spawn_blocking`（P0，见 §9.1 / §10.2）。
3. 🟡 ASR 侧车：上传流式化、长音频分窗增加 overlap（P1）；Sherpa ONNX spike 留 v1.2（P2）。
4. 🟡 前端状态：v1.1 渐进引入 Jotai/Zustand，先迁模块 singleton，**暂缓** `segments` 主状态（P1）。
5. 🟡 测试：接入 coverage 上报，补齐核心用户旅程 E2E（P1）；pre-commit 瘦身等 CI 基建留 P2。

---

## 2. 审查方法与数据来源

### 2.1 研究方法

| 方法 | 输出 |
|------|------|
| **代码库扫描** | 5 个 explore agent 并行扫描前端、Rust、ASR、波形、测试 5 大模块 |
| **外部调研** | 检索 React 状态管理、Tauri/Rust 后端、ASR 部署、波形引擎、前端测试等业内外部方案 |
| **定量指标** | 文件数、行数、测试数、架构守卫结果、Clippy 状态 |
| **对比基准** | 成熟开源项目（WhisperX、Sherpa ONNX、rqlite、Sonarr）、现代 React 桌面应用最佳实践 |

### 2.2 关键基线数据

| 指标 | 数值 |
|------|------|
| TS/TSX 文件数 | 882 |
| TS/TSX 测试文件数 | 278 |
| Rust 文件数 | 214 |
| Python ASR 源文件数 | 26 |
| Python 测试文件数 | 22 |
| TS/TSX 源码行数 | ~87,600 |
| Rust 源码行数 | ~32,696 |
| Python ASR 源码行数 | ~3,444 |
| 架构守卫 | 0 错误，40 警告 |
| `cargo clippy` | ~4 个 warning（dead code / needless borrow） |

### 2.3 调研来源索引

| 模块 | 主要外部参考 |
|------|--------------|
| 前端状态管理 | developerway.com、pulse-in.com、freeCodeCamp、juejin 2024–2025 状态管理指南 |
| Rust / SQLite | r2d2/r2d2-sqlite crate 文档；rqlite 生产配置；Bert Hubert SQLite WAL 文章；emschwartz 单写连接池基准 |
| ASR | Modal Whisper variants、TowardsAI Whisper 对比、OpenVoiceOS Sherpa ONNX 博客、k2-fsa/sherpa-onnx |
| 波形引擎 | WaveSurfer.js 文档；jessieji.com 客户端解码风险分析；DAW 产品公开文档 |
| 测试/CI | Defined Networking 测试策略、Codecov/SonarQube 实践、Vitest/Playwright 官方文档 |

### 2.4 Out of scope（本次未深入审查）

以下模块在路线图或代码库中存在，但**不在**本次五模块对比范围内；未列入不代表「无问题」：

| 模块 | 说明 |
|------|------|
| LLM / postprocess | 如 `postTranscribeStageB.ts`（378 行，接近 architecture hotspot） |
| 在线 STT bridge | 15+ 厂商集成细节与错误分类 |
| 安全 / 隐私 | 密钥存储、侧车 local token、上传路径权限（诊断包脱敏仅点到） |
| 导出格式竞品 | DOCX/SRT/TXT 与竞品细对比（导出系统仅作健康度标记） |

---

## 3. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | Rushi 已进入 v1 后期，P0–P4 验收完成，但功能膨胀带来架构债务。需要在不破坏现有交付的前提下，识别各核心模块与业内成熟方案的差距，为 v1.1+ 的 LLM-LOC、ASR 生态改进、波形精修、测试补强提供决策依据。 |
| **本仓现状** | 约 87.6k 行 TS/React、32.7k 行 Rust、Python ASR 侧车；采用「Controller + Service + Tauri 命令 + SQLite + FunASR Python 侧车」的垂直切片架构。 |
| **成功标准** | 产出覆盖 5 大核心模块的对比矩阵、高/中/低风险清单、可执行改进建议；每条建议都能落到具体文件或脚本，并给出验证命令。 |

---

## 4. 业内成熟路线（≥2）

### 4.1 前端状态管理

| # | 路线 | 代表实现 / 产品 | 核心机制 |
|---|------|-----------------|----------|
| A | **React hooks + Context 为主** | 小型 Tauri 应用、早期 Rushi | 纯 `useState`/`useReducer` + 模块级 singleton；通过 prop drilling 或单一 facade 传递。 |
| B | **轻量全局 store（Zustand / Jotai / Valtio）** | Linear、Figma 插件、多数现代 React 桌面应用 | Zustand：单一 store + selector；Jotai：原子化状态；Valtio：响应式代理。 |
| C | **Server-state 专用（TanStack Query / SWR）** | 任何需要缓存/刷新的 CRUD 应用 | 将「远程数据」与「UI 状态」分离，自动处理 loading/error/stale/optimistic update。 |

**业内共识要点**：
- 2024–2025 年主流趋势是将状态分为 **Remote / URL / Local / Shared** 四类，分别用不同工具处理。
- TanStack Query 是 server state 的 gold standard，Zustand 因无 Provider、学习成本低成为 client shared state 的首选。
- Context 仅适合低频全局值（theme、locale），不适合高频共享状态。

### 4.2 Rust 后端 / 数据层

| # | 路线 | 代表实现 / 产品 | 核心机制 |
|---|------|-----------------|----------|
| A | **手写 SQL + rusqlite，同步命令** | Rushi 当前 | 每个 Tauri command 新建 `Connection`，手写 schema/迁移，同步 IO。 |
| B | **连接池 + WAL + 异步 spawn_blocking** | rqlite、Sonarr、各种 Rust 桌面应用 | `r2d2-sqlite`/`deadpool-sqlite` + `PRAGMA journal_mode=WAL` + `BEGIN IMMEDIATE`；重 IO 在 `spawn_blocking` 中执行。 |
| C | **ORM / 强类型迁移（Diesel / sqlx / sea-orm）** | 大型 Rust 后端 | Diesel：编译时类型安全；sqlx：查询校验 + 异步；sea-orm：Entity 驱动。 |

**业内共识要点**：
- SQLite 生产配置标准：`PRAGMA journal_mode=WAL` + `busy_timeout` + 连接池。
- WAL 模式下读写可并发，配合单写连接 + 多读连接池可获得最佳写入性能（emschwartz 基准显示 ~20× 提升）。
- 重 IO 不应阻塞 Tauri 主线程，应使用 `async` command + `spawn_blocking`。

### 4.3 ASR 侧车 / 推理部署

| # | 路线 | 代表实现 / 产品 | 核心机制 |
|---|------|-----------------|----------|
| A | **FunASR Python + PyInstaller onedir** | Rushi 当前 | `funasr.AutoModel` 全流程，HTTP FastAPI 服务，侧车打包。 |
| B | **faster-whisper / WhisperX** | WhisperX、OpenAI Whisper API 自建 | CTranslate2 后端、VAD 切分、forced alignment、diarization、批处理。 |
| C | **Sherpa ONNX / funasr-runtime C++** | sherpa-onnx、Next-gen Kaldi / k2-fsa | ONNX Runtime / C++ runtime，模型量化，跨平台单二进制，CPU/GPU 通用。 |
| D | **云厂商托管 STT（OpenAI/Deepgram/阿里云）** | 在线 STT 面板已有支持 | 原生 REST/WebSocket API，按量计费，无需本地模型。 |

**业内共识要点**：
- WhisperX 在英文场景凭借 VAD + forced alignment + diarization 成为标杆，但中文优化不如 FunASR。
- Sherpa ONNX 以轻量、跨平台、CPU 友好为卖点，是离线 ASR 的轻量替代路线。
- 云 STT 适合隐私要求低、网络稳定的场景；Rushi 的离线需求决定了本地推理仍是主路径。

### 4.4 波形 / 音频编辑器

| # | 路线 | 代表实现 / 产品 | 核心机制 |
|---|------|-----------------|----------|
| A | **WaveSurfer.js + 自定义 Canvas/DOM overlay** | Rushi 当前 | 预渲染 peaks `.dat`、WS 负责波形、tier 滚动真源、Canvas 色带 + 最小 DOM overlay。 |
| B | **WaveSurfer Regions 插件** | oTranscribe、一般转写工具 | 全部 region 作为 DOM div，依赖插件事件。 |
| C | **自研 Native 波形引擎** | Adobe Audition、Pro Tools、Descript | 自研 Canvas/WebGL/GPU 渲染，采样级或帧级波形，多轨、clip、automation。 |

**业内共识要点**：
- 高密度语段场景下，全量 DOM region 会导致性能崩溃，必须做 display/interaction 分离。
- 客户端 `decodeAudioData` 不适合长音频（易 OOM），应使用服务端预渲染 peaks。
- Native DAW 的波形引擎复杂度极高，转写工具不应盲目对标。

### 4.5 测试与质量基础设施

| # | 路线 | 代表实现 / 产品 | 核心机制 |
|---|------|-----------------|----------|
| A | **Vitest + 模块级 vi.mock + Playwright smoke** | Rushi 当前 | 纯函数/hook 测试为主，少量组件/E2E，无统一网络 mock，无覆盖率门禁。 |
| B | **MSW + Vitest coverage + Storybook/Vitest Browser Mode** | 现代前端团队 | MSW 统一拦截 HTTP；coverage 阈值；Storybook play function 做组件交互测试。 |
| C | **分层测试金字塔 + Codecov/SonarCloud + 性能基准** | 成熟开源项目 | 单元 70%+/集成 20%/E2E 10%；PR coverage diff；性能回归测试。 |

**业内共识要点**：
- Vitest + Playwright 已成为 2024–2025 年前端测试主流组合。
- 测试金字塔仍适用，但 integration 层可借助 MSW + Storybook play function 增强。
- Coverage 不是唯一指标，但 CI 中 coverage diff + 阈值是防止 regression 的有效门禁。

---

## 5. 可复用评估

### 5.1 前端状态管理

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（当前） | 高 | 所有现有代码 | 无 | 已验证，但可维护性随功能膨胀下降 |
| B（Zustand/Jotai） | 中 | 替换模块级 singleton、draft store、env coordinator | 需要渐进迁移，不能一次性重写；与「controller 模式」兼容 | 增加 ~2-5KB 包体积；学习成本低 |
| C（TanStack Query） | 中 | 替换 ASR/LLM/STT 健康轮询、项目列表、文件加载等「远程状态」 | Tauri invoke 不是 HTTP，需要 custom queryFn；与当前 controller 分层冲突较大 | 收益在缓存/刷新统一，但引入复杂度 |

### 5.2 Rust 后端 / 数据层

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（当前） | 高 | 所有命令、迁移、schema | 无 | 简单但阻塞 IO、无池化 |
| B（池化+WAL+async） | 高 | `r2d2-sqlite` 可直接替换 `Connection::open`；`spawn_blocking` 包裹重命令 | 需要把同步 command 改为 async；schema 迁移可保留 | 显著提升并发与响应；风险可控 |
| C（ORM） | 低 | 不建议；schema 简单，ORM 收益低、迁移成本高 | 与手写 SQL 文化冲突；Tauri 命令层需重写 | 包体积、编译时间增加 |

### 5.3 ASR 侧车

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（当前 FunASR Python） | 高 | 全部现有侧车、模型缓存、manifest | 无 | 包体大、启动慢、单线程推理 |
| B（faster-whisper/WhisperX） | 中 | 可替换推理后端，保留 HTTP 契约与模型缓存层 | 中文场景 FunASR 更成熟；WhisperX 侧重英文 diarization | 需要重新评估中文 CER |
| C（Sherpa ONNX） | 中-高 | 可替换推理引擎，保留 FastAPI 服务壳 | 需要重新训练/适配模型目录；当前 catalog 需扩展 | 包体显著缩小、启动快、CPU 友好 |
| D（云 STT） | 中 | 在线 STT bridge 已支持 15+ 厂商 | 隐私/离线需求冲突；仅作为 fallback | 依赖网络与付费 |

### 5.4 波形引擎

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（当前） | 高 | WaveSurfer 实例、peaks LOD、Canvas band | 无 | 高密度语段性能可接受 |
| B（WS Regions） | 低 | 不适合 5000+ 语段场景 | 性能退化 | 无需自研交互，但违背性能目标 |
| C（自研 Native） | 低 | 未来若做多轨/频谱可考虑 | 当前阶段过度工程 | 成本极高 |

### 5.5 测试与质量

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（当前） | 高 | 所有测试 | 无 | 缺少覆盖率、E2E 浅 |
| B（MSW + coverage） | 高 | MSW 可拦截 fetch；`@vitest/coverage-v8` 易接入 | 需要重构部分 mock；Tauri invoke 不在 HTTP 层 | 收益明确，成本中等 |
| C（Codecov + 性能基准） | 中 | 可在 CI 接入 coverage 上报 | 需要维护阈值与 flaky 测试 | 长期收益 |

### 5.6 本仓已有可复用模块

- `services/waveform/`：peaks、视口、投影纯函数已较成熟，可继续扩展。
- `services/environmentCapabilityCoordinator.ts`：能力刷新调度已有雏形，可作为全局 store 迁移的过渡层。
- `scripts/check-architecture-guard.mjs`：规则紧贴项目债务，应持续维护。
- `services/asr/` 与 `services/stt/`：Provider 定义表 + 运行时配置模式已对齐业内共识，可复用到 LLM 配置。

---

## 6. 决策摘要

| 问题 | 结论 |
|------|------|
| **是否需要全局状态库？** | **v1 维持现状**（controller + 模块 singleton）。**v1.1 渐进引入** Jotai 或 Zustand，**第一批**仅替换 `environmentCapabilityCoordinator`、`segmentDraftStore`、`llmEnvRuntimeStore` 及事件总线；**保留** controller 协调层；**暂缓**迁移 `segments` 主状态。**v1 不引入** TanStack Query。 |
| **Rust 后端是否需要池化+WAL？** | **是，P0 高优先级**。分 Phase 实施：`DbState` 持 pool + WAL（Phase 1）→ 3 个重 IO 命令 async（Phase 2）→ 其余命令与 `thiserror`（Phase 3 / v1.1 后续）。 |
| **ASR 是否需要替换 FunASR Python？** | **v1.1 不替换**。继续优化 FunASR 侧车（并发、分窗重叠、上传流式化），但启动 **Sherpa ONNX spike** 作为 v1.2 候选。 |
| **波形引擎是否需要重写？** | **否**。修复已知高危 remount bug，继续在当前架构上优化。 |
| **测试是否需要补强 coverage + E2E？** | **是，P1**。接入 coverage 上报，补齐核心用户旅程 E2E（新建项目→导入→转写→导出）；lint-staged 瘦身、Dependabot 等留 P2。 |
| **不做什么** | 不引入 ORM、不大规模重写 controller、不替换 WaveSurfer、不引入 LiteLLM 网关。 |
| **与 ADR / architecture 关系** | 本报告是对现有 ADR/架构的「健康体检」，不推翻 ADR-0001、ADR-0003、ADR-0005 等决策。 |
| **风险与 spike 项** | ① Rust Phase 1 可独立合并，Phase 2 需大项目手测回归；② 全局 store 勿先动 `segments`，避免与 controller 边界冲突；③ Sherpa ONNX 中文效果需独立评估。 |

---

## 7. 模块逐项对比

### 7.1 前端架构（React + Tauri 壳）

#### 7.1.1 当前实现

Rushi 前端采用 **无全局状态库** 的设计：

- **Controller 模式**：`pages/useXxxController.ts` 作为页面级状态协调 hook，如 `useProjectController`（322 行）、`useProjectLifecycleController`（305 行）、`useTranscribeJobController`（403 行）。
- **Service 层**：`services/` 下按领域拆分为纯函数与模块级 store，如 `environmentCapabilityCoordinator`、`llmEnvRuntimeStore`、`segmentDraftStore`。
- **状态同步**：`segments` 用 `useState`，同时维护 `segmentsRef.current` 用于同步读取；跨模块刷新依赖 `window` 自定义事件。
- **与 Rust 边界**：`src/tauri/` 提供薄层 `invoke` 封装。
- **样式体系**：Tailwind + `tokens.ts`/`tokens.css` + 架构守卫禁止 `bg-[#...]`，执行严格。

#### 7.1.2 与业内对比

| 维度 | Rushi 当前 | 业内成熟方案 | 差距 |
|------|------------|--------------|------|
| **状态管理** | 纯 hooks + 模块 singleton | Zustand/Jotai/TanStack Query | 缺少全局状态抽象，跨组件同步靠事件/ref，可追踪性弱 |
| **数据获取** | 手动 controller 内封装 | TanStack Query + SWR | 无统一缓存/失效策略 |
| **组件组织** | 按功能领域分子目录 | atoms/molecules/organisms 或按页面 | 与业务对齐，但部分组件过大 |
| **样式** | Tailwind + token + guard | Tailwind + design system | **更严格**，执行到位 |
| **对话框** | 自研 `CompactFloatingDialog` | Radix/shadcn/headless UI | 自研程度高，风格一致但维护成本高 |

#### 7.1.3 关键风险

| 等级 | 问题 | 位置 | 影响 |
|------|------|------|------|
| 🔴 高 | `useProjectController` 暴露约 251 字段，巨型 facade | `pages/useProjectController.ts` | 任何子 controller 变更都影响顶层，重渲染风险 |
| 🔴 高 | State/Ref 双轨制：手动同步 `segmentsRef.current` | `useProjectEditorState`、`useSegmentMutationController` 等 | 容易脏读，同步遗漏 |
| 🟡 中 | 40 个文件超过 300 行 / 12 hooks 阈值 | 全目录 | 架构守卫噪音， mega-hook 趋势 |
| 🟡 中 | `environmentCapabilityCoordinator` 为模块级 singleton，测试需 reset | `services/environmentCapabilityCoordinator.ts` | 多实例/热更新可能泄漏 |
| 🟢 低 | 无 React Context，依赖 controller prop 传递 | 全组件树 | 当前可接受，但架构上无扩展机制 |

---

### 7.2 Rust 后端 / 数据层

#### 7.2.1 当前实现

- **数据库**：SQLite + `rusqlite`，手写 schema 与增量迁移；每次 command 调用 `Connection::open`。
- **事务与并发**：`PRAGMA busy_timeout = 5000`、`PRAGMA foreign_keys = ON`；未开启 WAL，无连接池。
- **命令层**：大量 `#[tauri::command]` 为同步函数，直接读写 DB/文件；`lib.rs` 用 `generate_handler!` 平铺注册约 100+ 命令。
- **侧车管理**：自定义 `std::process::Command` + HTTP loopback + supervisor FSM；支持 bundled CPU/CUDA、warmup、idle 回收、local token。
- **导出系统**：DOCX 由 Rust 完整实现（`docx-rs`），TXT/SRT 格式化在前端。
- **诊断包**：生成 ZIP，含脱敏 DB、日志尾部、编辑历史，隐私处理较完整。

#### 7.2.2 与业内对比

| 维度 | Rushi 当前 | 业内成熟方案 | 差距 |
|------|------------|--------------|------|
| **数据库连接** | 每命令新建 Connection | `r2d2-sqlite` / `deadpool-sqlite` | 频繁 IO 开销大，无池化 |
| **并发模式** | 默认 journal mode，依赖 busy_timeout | WAL + BEGIN IMMEDIATE | 读写串行，易 SQLITE_BUSY |
| **命令 IO** | 同步 command 直接阻塞主线程 | async + `spawn_blocking` | 大文件操作时 UI 可能冻结 |
| **迁移** | 手写 `ALTER TABLE` + 列检测 | `rusqlite_migration` / `diesel_migrations` | 当前幂等但缺少版本号 |
| **错误处理** | `Result<T, String>` 扁平化 | `thiserror` + 结构化错误 | 丢失 error code，不利于遥测/i18n |
| **侧车** | 自定义进程管理 | Tauri Sidecar API | 更灵活但复杂度更高 |
| **密钥** | `keyring` crate | `tauri-plugin-stronghold` | 当前跨平台 keyring 足够 |

#### 7.2.3 关键风险

| 等级 | 问题 | 位置 | 影响 |
|------|------|------|------|
| 🔴 高 | 同步命令直接阻塞 IO | `file_save_segments`、`project_create_from_audio`、`export_project_bundle` | 大项目/大音频时 UI 冻结 |
| 🔴 高 | 无 WAL + 无连接池 | `db/mod.rs` | 并发写能力弱，busy_timeout 可能超时 |
| 🔴 高 | 删除后磁盘清理失败不回滚 | `project_delete_inner` | 可能留下孤儿文件 |
| 🟡 中 | 错误信息全部扁平化为 String | 多数 command | 不利于错误分类与国际化 |
| 🟡 中 | Windows 无法自动清理 8741 占用进程 | `kill_loopback_listeners_on_port` | 切模型时可能无法重启侧车 |
| 🟢 低 | `pub use *` 汇总增加符号泄露 | `project/mod.rs` | IDE 索引负担 |

---

### 7.3 ASR 侧车（Python FastAPI + FunASR）

#### 7.3.1 当前实现

- **服务架构**：FastAPI，`GET /health`、`POST /v1/transcribe`、`POST /v1/transcribe/async`。
- **转写管线**：上传 → temp → FFmpeg 16kHz mono → FunASR `AutoModel` → 分段解析 → `TranscriptionResult`。
- **长音频**：固定窗口切片（blocking 300s/1800s、async 120s），无重叠/上下文。
- **模型管理**：ModelScope/HF 下载，本地缓存，manifest SHA256 校验，异步准备进度。
- **并发**：单线程推理执行器（`max_workers=1`），全局模型锁，所有 FunASR 请求串行。
- **打包**：PyInstaller onedir + ffmpeg-static，macOS/Linux/Windows CPU + Windows CUDA。

#### 7.3.2 与业内对比

| 维度 | Rushi 当前 | 业内成熟方案 | 差距 |
|------|------------|--------------|------|
| **推理后端** | FunASR Python AutoModel | WhisperX、Sherpa ONNX、faster-whisper | 启动慢、内存大、单线程 |
| **服务协议** | 自定义 HTTP + multipart | OpenAI-compatible / gRPC | 集成成本高 |
| **并发** | 单线程池 + 全局锁 | Riva batch、WhisperX 多进程 | 长音频阻塞其他请求 |
| **长音频** | 硬切窗口 | WhisperX VAD + alignment、FunASR 官方长音频 pipeline | 边界断句问题 |
| **说话人分离** | 不支持 | WhisperX/pyannote、Riva | 仅单说话人 |
| **热词/偏置** | 空格分隔字符串 | Riva tokenizer boost、Whisper prompt | 无权重、无短语级 |
| **模型分发** | 首次下载 + PyInstaller onedir | faster-whisper pip、Sherpa ONNX 单二进制 | 安装包最重 |
| **打包** | PyInstaller onedir + 外置模型 | pip install / 单可执行 | 小白友好但体积大 |

#### 7.3.3 关键风险

| 等级 | 问题 | 位置 | 影响 |
|------|------|------|------|
| 🔴 高 | 单线程推理执行器 + 全局模型锁 | `funasr_engine.py` | 所有请求串行，长音频阻塞 |
| 🔴 高 | 上传文件全量读入内存 | `app.py:_read_upload_to_temp()` | 大文件 OOM 风险 |
| 🔴 高 | 分窗边界无重叠/上下文 | `transcribe_windows.py` | 句子被截断，识别错误 |
| 🔴 高 | `ready_for_transcribe` 基于文件探测 | `runtime_caps.py` | 可能 false positive |
| 🟡 中 | PyInstaller spec 使用绝对路径 | `rushi-asr-sidecar.spec` | 不可移植 |
| 🟡 中 | 参数 strip 回退隐藏模型不兼容 | `funasr_engine.py` | 静默降级导致质量不可预期 |
| 🟢 低 | 健康端点未返回侧车版本 | `runtime_caps.py` | 升级兼容性判断困难 |

**补充（避免重复建设）**：
- 侧车 `transcribe_windows.py` 仍为硬切窗口，**转写阶段**无 overlap。
- Rust 层 `trim_adjacent_segment_overlaps`（`run_transcribe_cmd/save.rs`）与前端 lane 策略已处理**转写结果**的相邻语段 overlap，属于后处理，**不能**替代侧车分窗 overlap。
- 建议在侧车加 1–2s overlap 是为了**边界识别质量**（断句/截断），不是重复 Rust trim。

---

### 7.4 波形引擎

#### 7.4.1 当前实现

- **核心库**：WaveSurfer.js v7。
- **滚动真源**：`tierScrollRef.scrollLeft` 为唯一真源，WS 通过 `translate3d` 镜像。
- **缩放双轨**：layout px/s（显示）与 draw px/s（peaks 档位）分离，支持热切换。
- **语段显示/交互分离**：
  - Canvas band：绘制全部 packable 语段色带，viewport 裁剪。
  - DOM overlay：仅渲染选中语段 + drag draft。
- **性能策略**：语段列表虚拟窗口、peaks LOD 缓存（16 档）。

#### 7.4.2 与业内对比

| 维度 | Rushi 当前 | 业内成熟方案 | 差距 |
|------|------------|--------------|------|
| **波形渲染** | WaveSurfer + 预渲染 peaks | Audition/Pro Tools 自研、Audacity 采样级 | 无频谱图、无多声道独立显示 |
| **滚动/缩放** | tier 真源 + WS 镜像 | DAW 自研 timeline | 双轨是为适配 WS peaks 档位 |
| **语段/Region** | Canvas + 仅选中 DOM overlay | WS Regions / DAW clip | 高密度性能优，但放弃全区域交互 |
| **多轨编辑** | 单轨 | DAW 多轨 | Rushi 是转写工具，非 DAW |
| **文本-音频耦合** | segment 级 | Descript 词级对齐 | 未到词级同步 |

#### 7.4.3 关键风险

| 等级 | 问题 | 位置 | 影响 |
|------|------|------|------|
| 🔴 高 | `peakCacheGeneration` 触发整实例 remount | `useProjectWaveformMount.ts` | peaks LOD 升级时 WaveSurfer 被销毁重建，播放中断 |
| 🟡 中 | `mountRefs` 对象在每次渲染时重建（当前未造成 remount，但增加心智负担与后续回归风险） | `useProjectWaveform.ts` | 当前 effect deps 为单个 stable ref，暂无实际影响；但模式脆弱，建议 useMemo 化 |
| 🟡 中 | `WaveformSegmentBandCanvas` live drag 期间频繁重建事件监听 | `WaveformSegmentBandCanvas.tsx` | pointer move 带来监听拆装开销 |
| 🟡 中 | 大范围多选让 overlay 退化为全量 DOM | `waveformSegmentOverlayVisibility.ts` | lasso 多选时性能下降 |
| 🟡 中 | 播放中 peaks 热切换有间隙风险 | `waveformZoomSyncEngine.ts` | 可能产生 click/静音 |
| 🟢 低 | 脏检查 O(n) | `useSegmentDirtyState.ts` | 语段数大时拖慢 UI |

---

### 7.5 测试与 CI

#### 7.5.1 当前实现

- **前端**：Vitest + jsdom + React Testing Library，278 个测试文件。
- **Python**：pytest + FastAPI TestClient，22 个测试文件。
- **Rust**：cargo test，6 个 `*_tests.rs` 文件，约 365 个 `#[test]`。
- **E2E**：Playwright，2 个 spec（ASR HTTP smoke + Vite shell smoke）。
- **CI**：GitHub Actions，含 doc-links、security-audit、desktop、desktop-rust、asr 等 job。
- **架构守卫**：`check-architecture-guard.mjs`，0 错误 40 警告。

#### 7.5.2 与业内对比

| 维度 | Rushi 当前 | 业内成熟方案 | 差距 |
|------|------------|--------------|------|
| **覆盖率** | 无收集 | Codecov / SonarCloud | 无法量化回归 |
| **网络 mock** | 模块级 `vi.mock` | MSW | 跨测试易泄漏 |
| **E2E 深度** | 2 个 smoke spec | Playwright 覆盖核心旅程 | 未测转写/编辑/导出 |
| **pre-commit** | tsc + ESLint + 全量架构守卫 | lint-staged 仅 staged 文件 | 随仓库增长变慢 |
| **安全审计** | npm/cargo/pip audit | Dependabot / Snyk | 缺少自动依赖更新 |
| **性能测试** | 1 个 bench | Lighthouse CI / k6 | 无性能回归门禁 |

#### 7.5.3 关键风险

| 等级 | 问题 | 位置 | 影响 |
|------|------|------|------|
| 🔴 高 | 无覆盖率收集与门禁 | 全仓库 | 无法判断新增代码是否被测 |
| 🔴 高 | lint-staged 对全量文件跑 `tsc --noEmit` | `apps/desktop/lint-staged.config.mjs` | pre-commit 越来越慢 |
| 🟡 中 | Playwright E2E 依赖真实 ASR 服务 | `.github/workflows/ci.yml` | CI 易 flaky |
| 🟡 中 | 测试文件本身触发架构守卫警告 | 多个 `*.test.ts` | 警告噪音 |
| 🟢 低 | Vitest 配置极简 | `vitest.config.ts` | 缺少 reporter/retry/shard |

---

## 8. 综合差距矩阵

| 模块 | 架构健康度 | 与业内差距 | 改进成本 | 业务影响 | 优先级 |
|------|------------|------------|----------|----------|--------|
| Rust 后端 / 数据层 | 🟡 中 | 较大（池化/WAL/异步） | 中 | 高（UI 响应、并发稳定性） | 🔴 P0 |
| 波形引擎 | 🟡 中 | 小（实现 bug + 性能优化） | 低 | 高（播放/交互体验） | 🔴 P0 |
| ASR 侧车 | 🟡 中 | 中-大（并发、资源、分窗） | 中 | 高（转写吞吐量） | 🟡 P1 |
| 前端状态管理 | 🟡 中 | 中（全局 store 缺失） | 中 | 中（可维护性） | 🟡 P1 |
| 测试与 CI | 🟡 中 | 中（coverage/E2E） | 低-中 | 中（质量门禁） | 🟡 P1 |
| 导出系统 | 🟢 良 | 小 | 低 | 低 | 🟢 P2 |
| 视觉/样式体系 | 🟢 良 | 小 | 低 | 低 | 🟢 P2 |

---

## 9. 风险优先级与建议路线图

### 9.1 P0（应立即处理）

1. **修复波形 WaveSurfer remount 问题**（预计 0.5–1 天）
2. **Rust 后端连接池 + WAL + 重 IO 异步**（分 Phase，见 §10.2）：
   - **Phase 1**（2–3 天）：`DbState` 持 `r2d2` pool；连接 init 设 WAL + `busy_timeout`；迁移逻辑不变
   - **Phase 2**（3–5 天）：`file_save_segments`、`project_create_from_audio`、`export_project_bundle` 改 `async` + `spawn_blocking`
   - **Phase 3**（v1.1 后续）：其余重 IO 命令渐进迁移；`thiserror` 结构化错误

### 9.2 P1（v1.1 周期内）

3. ASR 侧车：上传流式化、分窗 overlap、单 worker → 队列化评估
4. 前端状态：引入 Jotai/Zustand，**第一批**迁模块 singleton 与事件总线；**暂缓** `segments` 主状态
5. 测试：接入 coverage 上报，补齐核心用户旅程 E2E（优先 mock ASR，避免 CI flaky）

### 9.3 P2（后续技术债）

6. CI 缓存优化、lint-staged 精简、Dependabot 接入
7. Sherpa ONNX spike（v1.2 候选）
8. Rust Phase 3 剩余命令与 `thiserror`（若 Phase 2 未全部完成则顺延）

---

## 10. 可执行建议与验证方式

### 10.1 建议 1：修复波形 WaveSurfer remount（P0）

**问题**：`useProjectWaveformMount` 的 effect deps 包含 `peakCacheGeneration`，而 `peakCacheGeneration` 在 peaks LOD 升级时递增，导致 WaveSurfer 实例被销毁重建，播放中断。

**复查结论**：初版报告误认为 `mountRefs` 对象重建会导致每次 re-render 都 remount。经核实，`mountRefs` 虽为每次渲染新建对象，但 effect deps 列出的是其内部单个 stable ref/state setter，因此不会触发 remount。真正触发 remount 的是 `peakCacheGeneration`。

**落地文件**：
- `apps/desktop/src/hooks/useProjectWaveform.ts`
- `apps/desktop/src/hooks/useProjectWaveformMount.ts`
- `apps/desktop/src/hooks/useWaveformPeaks.ts`

**建议改动**：
1. 将 `peakCacheGeneration` 从 mount effect deps 中移除；peaks 升级应通过 `useWaveformZoomSync` 做 `ws.load(url, peaks, duration)` 热切换，而非重建实例。
2. （可选 but 推荐）将 `mountRefs` 用 `useMemo` 缓存，避免未来误把对象本身加入 deps 导致回归。
3. mount effect 的 deps 应精简为 `mediaUrl` / `deferDecodeMount` 等真正会改变实例的依赖。

**验证方式**：
```bash
npm run typecheck && npm run test
# 手测：打开一个长音频，播放中切换缩放，观察是否出现波形闪烁/播放中断
```

---

### 10.2 建议 2：Rust 后端引入连接池 + WAL + 异步改造（P0，分 Phase）

**问题**：每命令新建 Connection、同步 IO 阻塞主线程、无 WAL。

**落地文件**：
- **Phase 1**：`apps/desktop/src-tauri/src/db/mod.rs`、`apps/desktop/src-tauri/src/lib.rs`（state 注册）
- **Phase 2**：`apps/desktop/src-tauri/src/project/segment_cmd.rs`、`project_create_cmd.rs`、`export_cmd.rs`
- **Phase 3**：其余重 IO 的 `#[tauri::command]`；错误类型逐步结构化

**建议改动**：

**Phase 1 — 连接池 + WAL（可独立 PR 合并）**
1. 在 `DbState` 中持有 `r2d2::Pool<SqliteConnectionManager>`（替代仅保存路径）。
2. 在连接初始化时设置：
   ```sql
   PRAGMA foreign_keys = ON;
   PRAGMA journal_mode = WAL;
   PRAGMA busy_timeout = 5000;
   ```
3. 将所有 `Connection::open` 调用改为从 pool 取连接；迁移逻辑保持不变。

**Phase 2 — 3 个重 IO 命令 async（需大项目手测）**
1. 将 `file_save_segments`、`project_create_from_audio`、`export_project_bundle` 从同步 `pub fn` 改为 `async fn`。
2. 内部 DB/文件 IO 用 `tokio::task::spawn_blocking` 包裹。
3. 写事务使用 `BEGIN IMMEDIATE` 避免 upgrade 导致的 `SQLITE_BUSY`。

**Phase 3 — v1.1 后续**
1. 其余重 IO 命令渐进迁移（不必一次性改 100+ command）。
2. 错误处理逐步引入 `thiserror` 结构化错误，前端先兼容字符串再迁移。

**验证方式**：

Phase 1：
```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --all-targets -- -D warnings
npm run typecheck && npm run test
```

Phase 2（在 Phase 1 基础上追加）：
```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
npm run typecheck && npm run test
# 手测：大项目保存、大音频导入、快速连续操作，观察 UI 是否卡顿
```

---

### 10.3 建议 3：ASR 侧车上传流式化与分窗优化（P1）

**问题**：上传文件全量读入内存；分窗硬切无重叠。

**与现有能力的关系**（避免重复建设）：
- Rust 层 `trim_adjacent_segment_overlaps` 与前端 lane 策略处理的是**转写结果**的相邻 overlap，属于后处理。
- 侧车硬切仍会在窗口边界产生识别错误；本建议的 overlap 针对**转写阶段识别质量**，不能因 Rust 已有 trim 而跳过。

**落地文件**：
- `services/asr/rushi_asr/app.py`
- `services/asr/rushi_asr/transcribe_windows.py`

**建议改动**：
1. 将 `multipart` 上传从 `list[bytes]` 改为流式写入 temp file，限制内存占用。
2. 长音频分窗增加 overlap（如 1–2 秒）；跨窗合并/去重在侧车或桌面层择一实现，勿与 Rust 后处理 trim 混淆职责。
3. 评估将 `_inference_executor(max_workers=1)` 改为队列化单 worker 或有限多 worker（需验证 FunASR 线程安全性）。

**验证方式**：
```bash
bash scripts/bootstrap-asr-venv.sh
source services/asr/.venv/bin/activate
python -m pytest services/asr/tests
# 手测：上传 500MB+ 音频、≥30min 音频，观察内存与边界识别质量
```

---

### 10.4 建议 4：引入轻量全局状态库（P1，渐进）

**问题**：`segmentsRef` + 事件总线 + 模块 singleton 三元组难以追踪；`useProjectController` 约 251 字段的 facade 聚合加剧维护成本。

**落地文件**：
- **第一批**：`apps/desktop/src/services/environmentCapabilityCoordinator.ts`、`apps/desktop/src/hooks/useSegmentDraftStore.ts`、`llmEnvRuntimeStore` 相关模块
- **暂缓**：`useProjectEditorState` / `segments` 主状态（避免与 controller 边界大规模冲突）
- **保留**：`pages/useXxxController.ts` 作为业务协调层

**建议改动**：
1. 选型 **Jotai**（原子化、与 React 并发模式友好）或 **Zustand**（更简单）。
2. **第一阶段**仅替换跨页面/跨组件共享的模块 singleton：
   - `environmentCapabilityCoordinator.latestSnapshot`
   - `segmentDraftStore`
   - `llmEnvRuntimeStore`
3. **第二阶段**（视第一阶段回归情况再定）：评估 `segmentsRef`/事件总线是否迁入 store。
4. 保留 controller 模式作为业务协调层，不一次性推翻。

**验证方式**：
```bash
npm run typecheck && npm run test
# 回归：保存、撤销/重做、切换项目、环境面板状态同步
```

---

### 10.5 建议 5：测试覆盖率与 E2E 补强（P1）

**问题**：无 coverage、E2E 仅 smoke。

**落地文件**：
- `apps/desktop/vitest.config.ts`
- `.github/workflows/ci.yml`
- `apps/desktop/tests/e2e/`

**建议改动（P1）**：
1. 安装 `@vitest/coverage-v8`，在 CI 中生成并上传 coverage（Codecov 或 artifact）。
2. 补齐 Playwright E2E（优先 mock ASR / fixture，避免依赖真实侧车导致 flaky）：
   - 新建项目 → 导入音频 → 转写 → 保存 → 导出 TXT/SRT/DOCX
   - 语段编辑、拆分/合并、撤销/重做
   - 环境面板：切换 ASR 模型、准备模型

**建议改动（P2，可与 §9.3 合并）**：
3. 将架构守卫从 pre-commit 全量扫描改为 CI 全量 + pre-commit 仅 staged 相关检查。
4. lint-staged 避免任意 staged TS 触发全量 `tsc --noEmit`。

**验证方式**：
```bash
npm run test -- --coverage
npm run desktop:test:e2e
node scripts/check-architecture-guard.mjs
```

---

### 10.6 建议 6：其他中低风险项（P2）

| # | 建议 | 落地文件 | 验证 |
|---|------|----------|------|
| 6.1 | Rust 错误处理结构化 | 多数 `*.rs` | `cargo clippy` + 类型检查 |
| 6.2 | Windows 清理 8741 进程 | `asr_sidecar/` | 在 Windows 手测切模型 |
| 6.3 | 诊断包 JSON 脱敏改进 | `diagnostic_db_sanitize.rs` | 跑诊断包生成，检查敏感字段 |
| 6.4 | 移除 `services/fixtures/` 空目录或补充说明 | `services/fixtures/` | 无 |
| 6.5 | `pyproject.toml` 描述更新 | `services/asr/pyproject.toml` | 无 |

---

## 11. 结论

Rushi 是一个架构决策清晰、执行纪律较强的单人项目。本次审查未发现需要推翻整体架构的根本性问题，但在 **Rust 后端并发/IO 模型**、**波形引擎实现细节**、**ASR 侧车资源与并发模型**、**前端状态管理抽象**、**测试覆盖率/E2E** 五个方向存在与业内成熟方案的可识别差距。

**下一步建议**：
1. 立即修复波形 remount bug（P0，低投入高回报）。
2. 为 Rust Phase 1/2 写 acceptance spec 三件套，再动 `db/mod.rs`（P0，分 Phase 合并）。
3. 在 v1.1 路线图中纳入 ASR 侧车上传流式化与分窗 overlap（P1）。
4. 全局 store **第一批**迁模块 singleton，暂缓 `segments`（P1）。
5. 接入 coverage 与核心旅程 E2E（P1）；pre-commit / Dependabot 等 CI 基建（P2）。

---

## 12. 附录

### 附录 A：引用文档

- [`AI_QUICKSTART.md`](../../../AI_QUICKSTART.md)
- [`CONTEXT.md`](../../../CONTEXT.md)
- [`docs/architecture/README.md`](../../architecture/README.md)
- [`docs/execution/plans/rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)

### 附录 B：外部参考

- React 状态管理：
  - [developerway.com/posts/react-state-management-2025](https://www.developerway.com/posts/react-state-management-2025)
  - [pulse-in.com/guidances/react-state-management-2024-guide](https://pulse-in.com/guidances/react-state-management-2024-guide)
- Tauri Sidecar：[v2.tauri.app/develop/sidecar/](https://v2.tauri.app/develop/sidecar/)
- SQLite WAL / 连接池：
  - [r2d2](https://lib.rs/crates/r2d2)
  - [r2d2-sqlite](https://crates.io/crates/r2d2_sqlite)
  - [Bert Hubert — SQLite BUSY despite timeout](https://berthub.eu/articles/posts/a-brief-post-on-sqlite3-database-locked-despite-timeout/)
  - [emschwartz — SQLite connection pool write performance](https://emschwartz.me/psa-your-sqlite-connection-pool-might-be-ruining-your-write-performance/)
- ASR 生态：
  - [Status of Whisper ASR Libraries](https://alphacephei.com/nsh/2024/04/20/status-of-whisper.html)
  - [Sherpa ONNX](https://k2-fsa.github.io/sherpa/onnx/)
  - [OpenVoiceOS ONNX ASR](https://blog.openvoiceos.org/posts/2026-02-16-onnx-asr)
  - [Modal — Choosing Whisper Variants](https://modal.com/blog/choosing-whisper-variants)
- 波形引擎：
  - [WaveSurfer.js](https://wavesurfer.xyz/)
  - [jessieji.com — Large audio waveform client-side risk](https://jessieji.com/2019/why-generating-waveform-for-a-large-audio-file-may-not-be-a-good-thing)
- 前端测试：
  - [Vitest — Coverage](https://vitest.dev/guide/coverage.html)
  - [Playwright — Best practices](https://playwright.dev/docs/best-practices)
  - [Defined Networking — Modern Frontend Testing](https://defined.net/blog/modern-frontend-testing/)

### 附录 C：数据快照

| 指标 | 数值 | 备注 |
|------|------|------|
| TS/TSX 源文件 | 882 | 含测试 |
| TS/TSX 测试文件 | 278 | 占 31.5% |
| Rust 源文件 | 214 | |
| Python ASR 源文件 | 26 | |
| Python 测试文件 | 22 | |
| TS/TSX 总行数 | 87,600 | 含测试 |
| Rust 总行数 | 32,696 | |
| Python ASR 总行数 | 3,444 | |
| 架构守卫 | 0 errors / 40 warnings | 2026-06-16 |
| cargo clippy | ~4 warnings | dead code / needless borrow |

**复现命令**（下次审查对比 delta 时使用，在仓库根目录执行）：

```bash
# TS/TSX 文件数
find apps/desktop/src - \( -name '*.ts' -o -name '*.tsx' \) | wc -l

# TS/TSX 测试文件数
find apps/desktop/src - \( -name '*.test.ts' -o -name '*.test.tsx' \) | wc -l

# TS/TSX 总行数（含测试）
find apps/desktop/src - \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 wc -l | tail -1

# Rust 源文件与行数
find apps/desktop/src-tauri/src -name '*.rs' | wc -l
find apps/desktop/src-tauri/src -name '*.rs' -print0 | xargs -0 wc -l | tail -1

# Python ASR
find services/asr/rushi_asr -name '*.py' ! -path '*/tests/*' | wc -l
find services/asr/tests -name '*.py' | wc -l

# 架构守卫 warning 数
node scripts/check-architecture-guard.mjs 2>&1 | grep -c '⚠️' || true

# useProjectController 返回字段数（近似）
grep -c '^\s*[a-zA-Z_][a-zA-Z0-9_]*:' apps/desktop/src/pages/useProjectController.ts
```

### 附录 D：复查核实记录

本次复查对初版报告中的关键问题逐一回到源码验证，结论如下：

| 原结论 | 复查结果 | 说明 |
|--------|----------|------|
| `mountRefs` 对象重建导致每次 re-render remount | ❌ **误报** | effect deps 为单个 stable ref/setter，对象重建本身不触发 remount |
| `peakCacheGeneration` 触发 WaveSurfer remount | ✅ **确认** | `useWaveformPeaks.ts` 在 peaks bootstrap/complete 时递增 generation；`useProjectWaveformMount` effect deps 含 `peakCacheGeneration` |
| Rust 每命令新建 Connection / 无 WAL / 无池化 | ✅ **确认** | `project/utils.rs:41-47` 每次 `Connection::open`；全仓库无 `PRAGMA journal_mode=WAL`；`DbState` 不持 pool |
| Rust 同步 command 直接阻塞 IO | ✅ **确认** | `file_save_segments`、`project_create_from_audio`、`export_project_bundle` 均为同步 `pub fn`，内部读写 DB/文件 |
| ASR 单线程推理 + 全局锁 | ✅ **确认** | `funasr_engine.py:40-42` `_runtime_lock` + `_inference_executor(max_workers=1)` |
| ASR 上传全量读内存 | ✅ **确认** | `app.py:202-211` 用 `list[bytes]` 累积所有 chunks 后再写入 temp |
| ASR 分窗无重叠 | ✅ **确认** | `transcribe_windows.py:66-76` 硬切；注释明确 overlap trimming 在 Rust 层 |
| 前端 `useProjectController` 为巨型 facade | ✅ **确认** | 文件 322 行，返回对象约 **251** 字段 |
| 前端 `segmentsRef` + `segments` state 双轨 | ✅ **确认** | `useProjectEditorState.ts:35,40` 同时存在；多处 `segmentsRef.current` 同步读写 |
| `environmentCapabilityCoordinator` 模块 singleton | ✅ **确认** | 模块级 `registeredDeps`/`latestSnapshot`/`listeners`；提供 `resetEnvironmentCapabilityCoordinatorForTests` |
| lint-staged 对全量跑 `tsc --noEmit` | ✅ **确认** | `apps/desktop/lint-staged.config.mjs:7` 任意 staged TS/TSX 都触发全量 typecheck |
| 无 coverage / E2E 浅 | ✅ **确认** | `vitest.config.ts` 极简；Playwright 仅 2 个 spec；CI 无 coverage 上传 |

### 附录 E：变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-16 | 初版：完成全量扫描、外部调研、差距矩阵与可执行建议 |
| 2026-06-16 | 复查：修正波形 remount 根因（`mountRefs` 误报 → `peakCacheGeneration` 确认），补充逐项核实记录 |
| 2026-06-16 | 整合：将原独立调研 brief（问题陈述、业内路线、可复用评估、决策摘要）并入本报告，形成自包含的完整审查文档 |
| 2026-06-16 | 修订：统一测试 P1、§6 全局 store 措辞、ASR overlap nuance、Rust P0 分 Phase、§2.4 out of scope、附录 C 复现命令 |
