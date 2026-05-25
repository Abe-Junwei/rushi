# Rushi 项目架构整改报告 — 基于 Oumi 功能调研

> 报告编号：ARC-2025-05-25
> 调研来源：https://github.com/oumi-ai/oumi
> 编制日期：2026-05-25
> 修订日期：2026-05-25（对照代码库与 `docs/execution/reviews/` 同步）
> 状态：**Part I 已评审（能力边界真源）** · **排期真源** → [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) · Part II 仅长期参考 · UI 重设计已验收（2026-05-25）

---

## 执行摘要

本次调研对开源基础模型平台 **Oumi**（8.8k stars）进行了系统性架构分析。原始报告将 Oumi 能力映射为 6 大整改方向，但经代码库现实约束评审后，**实施排期从「平台化跃迁」重排为「最小可验证薄片」**。

**保留的战略方向**：
- 引入 LLM 转录后处理层（先做 `auto_punctuate` 一个功能）
- MCP Agent 只读集成（先读项目/语段，不写）
- 质量评估扩展（先留接口，不立刻跑 LLM judge）

**明确降级/排除**：
- ❌ 不新建 `services/llm/` + 5 种引擎的「统一推理引擎层」
- ❌ MCP 不写操作（`edit_segment`、`add_glossary_term`）
- ❌ YAML 不做主真源（密钥安全、UI 同步、跨平台路径未解决）
- ❌ 纠错记忆直接生成 synthetic dataset（schema 缺少 context/domain/privacy）
- ❌ 将 LLM 后处理打包进 ASR PyInstaller 侧车（体积与依赖策略冲突）

**当前工程节奏**：Rushi 是「本地桌面 + SQLite + Python ASR 侧车」的消费级工具，AGENTS.md 要求每轮仅一个纵向薄片、非 trivial 先 spec。本报告按此纪律重排。

**文档真源优先级**（与其它文档冲突时）：`代码` > `docs/architecture/` > `docs/execution/reviews/` > **本报告 Part I** > 本报告 Part II（愿景，非待办清单）。

---

## Part I — 采纳规划（当前执行路径）

### 一、Rushi 现状诊断

#### 1.1 当前架构

| 层级 | 技术 | 职责 |
|------|------|------|
| 桌面壳 | Tauri 2 + React 19 | UI 渲染、用户交互、在线 STT 壳（`stt_native` / `online_stt_bridge`） |
| 数据持久化 | SQLite (rusqlite) | 项目、文件、语段（含稳定 `uid`）、编辑日志、术语库、纠错记忆 |
| ASR 推理 | Python FastAPI Sidecar | FunASR / SenseVoice 本地推理；`prepare-default` / `prepare-status` |
| 在线 STT | Rust reqwest 直连 | 多厂商 API（合约见 `docs/architecture/stt-online-providers.md`） |
| 波形渲染 | WaveSurfer.js | 语段 regions（按 `uid` diff；`packages/wasm-waveform` 已移除） |
| 语段正文编辑 | `useSegmentDraftStore` | 草稿与 `flushSegmentTextDrafts`（非 DOM query） |

#### 1.2 当前痛点

| 编号 | 痛点 | 严重程度 |
|------|------|----------|
| D-001 | ASR 侧车后处理能力空白：只有规则级纠错记忆，无语义级后处理 | 🔴 高 |
| D-002 | 推理路径异构：本地 ASR（HTTP 侧车）与在线 STT（Rust 壳）分离；不宜强行统一抽象 | 🟡 中 |
| D-003 | AI Agent 集成缺失：桌面为信息孤岛，无 MCP 只读服务 | 🔴 高 |
| D-004 | 质量评估偏批跑：CER / term_hit 在 `eval_metrics.py` + `eval-run.py`；桌面无质量 Tab、无 LLM judge | 🟡 中 |
| D-005 | 配置分散：ASR 环境变量、在线 STT 内存 key、桌面 `env` 等；无统一 typed profile | 🟡 中 |
| D-006 | 模型下载 UI **不完整**：环境面板已有 `usePrepareModelController`（异步 prepare + 进度/失败文案）；缺首次引导、缓存占用一览、manifest 校验可视化 | 🟡 中 |

#### 1.3 已完成整改（架构基线，截至 2026-05-25）

| 整改项 | 状态 | 说明（以仓库当前为准） |
|--------|------|------------------------|
| `project_cmd.rs` 单体拆分 | ✅ | `apps/desktop/src-tauri/src/project/` 多模块（`segment_cmd`、`project_bundle_cmd` 等） |
| `EditorView` 拆分 | ✅ | `EditorView.tsx` ~189 行 + `components/editor/*` |
| Lifecycle 编排拆分 | ⚠️ 部分 | 已抽 busy/list/editor；`useProjectLifecycleController` **~380 行 / 21 hooks**（守卫已告警，路线图 **R0** 处理） |
| `export_cmd` 拆分 | ✅ | `export_cmd.rs` ~94 行；项目包逻辑在 `project_bundle_cmd.rs` |
| 文件容器 `file_id` | ✅ | `project_run_transcribe(file_id)` 等已对齐（见 `run_transcribe_cmd.rs`） |
| 语段 `uid` + 按 uid 保存 | ✅ | `migrate_segments_uid`、交换 idx 前临时负 idx（`db.rs`、`segment_cmd.rs`） |
| 语段草稿 store | ✅ | `useSegmentDraftStore` + `flushSegmentTextDrafts` |
| 波形 region 稳定身份 | ✅ | `segmentRegionId(uid)`；事件回调持 uid 动态解析 index |
| lucide-react 图标 | ✅ | 编辑器/工具栏统一 |
| WASM 波形包 | ✅ 移除 | 渲染真源为 WaveSurfer |

> 历史 commit（`b71f77a`、`ee88012` 等）仅作溯源参考；排期与验收以**当前行数与测试快照**为准。

#### 1.4 工程验证快照（2026-05-25）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- 前端 test：**139** passed；架构守卫：0 错误 / **2 警告**（lifecycle 行数 + hook 数）
- Rust test：30 passed
- 工作区相对 `origin/main` 有大量未提交改动（uid/波形/关窗等），见路线图 §13

---

### 二、评审结论

原始报告（Part II）的战略方向被采纳，但实施排期经架构评审后重排：

| 原始报告 | 评审后调整 | 原因 |
|----------|-----------|------|
| P0-1: `services/llm/` + 5 种引擎 | ❌ 降级 | 包体积、依赖冲突、PyInstaller 策略冲突风险高 |
| P0-2: MCP 8 Tools（含写）+ 3 Resources | ⚠️ 只读版 | `edit_log` 为批次级，不满足写操作审计 |
| P1-1: LLM-as-a-Judge 四维评分 | ⚠️ 留接口 | rubric 先做，不立刻跑 judge |
| P1-2: 纠错记忆 → synthetic dataset | ❌ 排除 | `correction_memory` 缺 context/domain/privacy |
| P2-1: YAML 配置主真源 | ⚠️ 导入/导出格式 | 密钥与 UI 双写未解决 |
| P2-2: 模型下载从零建设 | ⚠️ **差额产品化** | 侧车能力已有；补 UI/onboarding/缓存管理 |

---

### 三、重排后的 4 个薄片

#### P0：后处理最小闭环（建议 1～1.5 周，单人）

**目标**：验证「云端 LLM 标点增强」在桌面环境中的可行性；**默认远程 API**，不增大 ASR 侧车体积。

**范围限定**：

| 项 | 做 | 不做 |
|----|-----|------|
| 功能 | 仅 `auto_punctuate`（中文自动标点） | `smart_segment`、`normalize_text`、`speaker_diarization` |
| Provider | 1 个 OpenAI-compatible HTTP（如百炼 / DeepSeek） | 本地 vLLM / Transformers / llama.cpp |
| 前端 | 预览 diff，用户确认后写回当前语段 | 静默覆盖、全文件批量 |
| 运行时 | **Tauri 命令 + Rust HTTP**（或独立轻量进程） | **不**放入 `services/asr` PyInstaller 侧车 |
| 架构 | 薄 `postprocess` 契约 + 单实现 | 统一 InferenceEngine |

**信任边界与调用链（实施前须在 spec 中定稿）**：

```
React（预览 UI）
  → invoke('postprocess_auto_punctuate', { file_id?, segment_uid, text, neighbor_snippets? })
  → Rust：读 keychain / 设置中的 api_key_id，HTTPS 调 OpenAI-compatible
  → 返回 { text, diff, provider, latency_ms }
  → 用户确认 → updateSegmentText / flushSegmentTextDrafts 写回
```

- API Key：**不得**明文进 repo；优先 keychain 或现有「在线能力」内存 key 模式的一次性扩展。
- 隐私：首次使用须明示「语段文本将发往云端」；失败时返回原文 + 中文错误，不上传 stack trace。
- 与编辑模型对齐：写回前尊重 `useSegmentDraftStore`（确认后 `clearDraft` / `updateSegmentText`）。

**接口草案**：

```typescript
// apps/desktop/src/tauri/projectApi.ts（示意）
interface PostprocessAutoPunctuateRequest {
  task: "auto_punctuate";
  text: string;
  segment_uid: string;
  neighbor_snippets?: string[];  // 可选：前后语段摘录，非 UI「上下文菜单」
}

interface TextDiffSpan {
  start: number;
  end: number;
  kind: "insert" | "delete" | "replace";
}

interface PostprocessAutoPunctuateResponse {
  text: string;
  diff: TextDiffSpan[];
  provider: string;
  latency_ms: number;
}
```

```rust
// apps/desktop/src-tauri/src/postprocess_cmd.rs（新建，示意）
// Rust 侧：reqwest + 超时 + 取消（与 invoke 生命周期绑定）
```

**实施门禁（先于编码）**：

- [ ] `docs/execution/specs/auto-punctuate-intent.md`
- [ ] `docs/execution/specs/auto-punctuate-plan.md`
- [ ] `docs/execution/specs/auto-punctuate-acceptance.md`
- [ ] `docs/architecture/` 或 ADR 短文：后处理**不进** ASR 侧车

**验证标准**：

- [ ] 手测 10 条无标点文本，标点合理率 > 80%（人工表）
- [ ] 超时（> 30s）降级：原文 + 提示
- [ ] 关闭预览 / 取消：中断 in-flight 请求
- [ ] 网络错误：中文提示，无原始 stack 暴露给用户
- [ ] 确认写回后 DB 与草稿 store 一致
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 全通过
- [ ] 相关 Rust 单测（HTTP mock 或 stub）

---

#### P0.5：质量评估扩展（1～2 周，**可与 P0 并行调研**）

**目标**：在现有批跑指标基础上，为桌面预留评估插槽；**复用** `services/asr/rushi_asr/eval_metrics.py`，避免重复实现 CER。

**范围限定**：

| 项 | 做 | 不做 |
|----|-----|------|
| 规则评估 | 包装现有 `cer_chars` / `term_hit_rate`；可选同义词表扩展 | 语义级 LLM judge |
| 接口 | `QualityEvaluator` trait/协议 + rubric YAML **schema 校验** | 运行 judge |
| 前端 | 「质量概览」只读 Tab（可先展示最近一次 `eval-run` 报告路径/摘要） | 逐语段实时 judge |
| 数据 | `correction_memory` 导出 JSONL + 脱敏确认 | synthetic dataset |

**验证标准**：

- [ ] `CerEvaluator` / `TermHitEvaluator` 委托 `eval_metrics`（或共享 crate/模块），结果与 `eval-run.py` 一致
- [ ] rubric YAML 可解析并校验（不执行 LLM）
- [ ] correction_memory 导出含脱敏步骤

---

#### P1：MCP 只读版（约 2 周，**不依赖 P0**；依赖 `file_id` / DB 路径稳定）

**目标**：让外部 Agent 只读访问当前工作库中的项目与转写。

**范围限定**：

| 项 | 做 | 不做 |
|----|-----|------|
| Tools | `list_projects`、`get_project`、`get_transcript`、`search_segments` | 任何写操作 |
| Resources | `transcript://{file_id}`、`project://{project_id}` | 改 glossary / 语段 |
| 数据 | 只读打开 `DbState` 下 `rushi.sqlite3`（注意与桌面写锁并发：只读连接或快照） | 跨用户目录任意读 |
| 格式 | `get_transcript` **复用** `exportFormatters` 的 Markdown/SRT 逻辑 | 第三套文本格式 |
| 部署 | 独立 `services/mcp/` 进程；**127.0.0.1** 监听 | 打进 ASR 侧车 |
| 安全 | 默认关；设置页显式开启；关闭后进程退出或 403 | 0.0.0.0 暴露 |

**验证标准**：

- [ ] Claude Desktop / Cursor 配置后能 `list_projects` → `get_transcript`
- [ ] 关闭开关后请求失败且桌面不受影响
- [ ] 未开启时桌面启动无额外端口监听

---

#### P2：配置与模型体验产品化（2～3 周）

**目标**：在 **已有** `usePrepareModelController` + 侧车 `prepare-default` / `prepare-status` / manifest 之上，补齐产品化差额。

**已有（勿重复建设）**：

- 环境面板：异步下载、进度条、失败文案、重试（`usePrepareModelController.ts`）
- 侧车：manifest SHA256 校验（`RUSHI_MODEL_VERIFY_MANIFEST`）
- 文档：`docs/architecture/asr-sidecar-funasr-policy.md`

**本轮差额**：

| 项 | 做 | 不做 |
|----|-----|------|
| 模型下载 | 首次启动向导 / 全局进度（可复用 prepare 逻辑） | 侧车断点续传（T-004 另调研） |
| 校验展示 | UI 展示 manifest 校验结果 | 强制企业策略 |
| 缓存 | 设置页：缓存目录、占用、一键清理 | 云同步 |
| 配置 | 新建 `profile.rs`（或等价模块）typed profile；导入/导出 **无密钥** | YAML 第一真源 |
| 密钥 | postprocess / 在线 STT：`api_key_id` → keychain | 明文落盘 |

> 注意：桌面前端环境见 `apps/desktop/src/config/env.ts`；Rust profile 勿与之混名。

**配置架构草案**：

```rust
// apps/desktop/src-tauri/src/profile.rs（新建，示意）
#[derive(Serialize, Deserialize)]
pub struct RushiProfile {
    pub name: String,
    pub asr: AsrConfig,
    pub postprocess: Option<PostprocessConfig>,
}

#[derive(Serialize, Deserialize)]
pub struct PostprocessConfig {
    pub provider: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key_id: String,  // keychain 引用，非明文
}
```

**验证标准**：

- [ ] 新用户路径：下载进度可见、失败可重试
- [ ] 设置页：缓存目录与清理
- [ ] 配置导出 YAML 不含 api_key
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 全通过

---

### 四、明确不做（本轮及下轮）

| 项 | 原因 |
|----|------|
| vLLM / Transformers 本地 LLM | 体积、GPU、PyInstaller |
| 统一 InferenceEngine | ASR 与 LLM IO 范式不同 |
| MCP 写操作 | 审计与二次确认未设计 |
| YAML 作为主真源 | 密钥与 UI 双写 |
| correction_memory → synth | schema 不足 |
| LLM 进 ASR 侧车 wheel | 与 P0 信任边界冲突 |
| `smart_segment` / `normalize_text` | 等 P0 验证后再评 |

---

### 五、技术债与依赖

| ID | 债项 | 影响轮次 | 说明 |
|----|------|----------|------|
| T-001 | `transcribe.rs` ~305 行 | 任意 | 在线已拆 `transcribe_native_online.rs`；仍可继续切 |
| T-002 | `HTTP_CLIENT` 在 `types.rs` | P0/P1 | 后处理 / MCP 前迁至 `utils/http.rs` |
| T-003 | `AUDIO_ONLY` 常量 | P2 | 配置整理时确认 |
| T-004 | 模型断点续传 | P2 后 | 侧车未实现 |
| T-005 | `useProjectLifecycleController` ~380 行 / 21 hooks | **R0** | 架构守卫已告警，见路线图 ENG-0 |
| T-006 | `architecture-split-plan.md` 行数表过期 | 文档 | 与 §1.3 同步更新 |

---

### 六、推荐执行顺序

> **已并入统一路线图** [`docs/execution/plans/rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（§3–§4、§10）。  
> 摘要：R1–R2 自动标点 → R3 模型体验 → R4 质量插槽 → R5 MCP → R6–R8 协作最小闭环 → R9 发版验收。

### 七、每轮验证命令

```bash
# Rust
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --all-targets -- -D warnings

# Frontend
npm run typecheck
npm run test
npm run lint

# Architecture Guard
node scripts/check-architecture-guard.mjs

# Integration（发版前）
npm run test:all
bash scripts/p0-acceptance.sh
```

---

## Part II — 原始愿景参考（Oumi 全能力映射）

> **非执行待办**。以下保留 Oumi 全能力映射，供长期对照。实施一律以 Part I 为准；若 Part II 与 Part I 冲突，以 Part I 与代码为准。

### 一、Oumi 架构模式总览

| Oumi 模式 | Rushi 对应场景 | 借鉴价值 |
|-----------|----------------|----------|
| **统一推理引擎抽象** | 云端后处理 + 切换厂商 | ⭐⭐⭐⭐（**不**首轮落地） |
| **MCP Server** | Agent 读转写项目 | ⭐⭐⭐⭐⭐ |
| **LLM-as-a-Judge** | 转录质量评估 | ⭐⭐⭐⭐ |
| **数据合成管道** | 纠错记忆 → 训练数据 | ⭐⭐⭐（schema 未就绪） |
| **YAML 配置驱动** | ASR/后处理配置 | ⭐⭐⭐⭐（仅导入导出） |
| **模型下载与缓存** | prepare + manifest | ⭐⭐⭐（部分已有） |

### 二、Oumi 核心代码参考

| 组件 | Oumi 路径 | Rushi 对应（愿景） |
|------|-----------|-------------------|
| 推理引擎基类 | `oumi/core/inference/base_inference_engine.py` | 无；P0 用薄 HTTP 客户端 |
| 配置系统 | `oumi/core/configs/inference_config.py` | `src-tauri/src/profile.rs`（待建） |
| MCP Server | `oumi/mcp/` | `services/mcp/`（待建） |
| 评估框架 | `oumi/core/evaluation/` | 复用 `eval_metrics.py` + 可选 `services/eval/` |

### 三、Oumi 推理引擎架构（参考）

Oumi 支持多种引擎，统一 `infer(conversations, config)`。**Rushi 不照搬**；若未来多厂商后处理，可借鉴 Remote 引擎的重试与限流，而非首轮抽象。

### 四、Oumi MCP 设计（参考）

Dry-run + confirm 值得借鉴。Rushi `edit_log` 仅为批次级（如 `save_segments`），**写操作 MCP 仍排除**。

### 五、Oumi 数据合成管道（参考）

`correction_memory` 缺 project/domain/context/privacy → **不生成 synthetic dataset**。

### 六、风险评估（原始 + 评审后）

| 风险 | 概率 | 影响 | 缓解（评审后） |
|------|------|------|----------------|
| 本地 LLM 不足 | 中 | 高 | P0 **默认云端** |
| MCP 攻击面 | 低 | 高 | 只读、127.0.0.1、默认关闭 |
| 侧车体积膨胀 | 中 | 中 | LLM/MCP **不进** sidecar |
| 隐私（云端标点） | 中 | 高 | 明示同意 + 可取消；Part I P0 验收 |

### 七、术语对照表

| Oumi 术语 | Rushi 术语 | 说明 |
|-----------|------------|------|
| Inference Engine | 后处理 HTTP 客户端 | 非统一 ASR/LLM 引擎 |
| Recipe | Profile 模板 | 预置 provider + 参数 |
| Judge | 质量评估器 | 首轮仅规则指标 |
| Synth | 数据合成 | 排除 |
| Sidecar | ASR 侧车 | 仅 FunASR 推理 |

---

## 文档索引

| 文档 | 作用 | 状态 |
|------|------|------|
| `rushi-execution-roadmap.md` | **排期真源**（单机 + 协作 + 验收） | 2026-05-25 起 |
| `oumi-remediation-report.md` | **本文档**：Oumi 边界 + 接口草案 + Part II 愿景 | Part I 已评审 |
| `auto-punctuate-{intent,plan,acceptance}.md` | P0 实施三件套 | **待编写**（P0 门禁） |
| `architecture-split-plan.md` | Rust/UI 拆分规划 | ⚠️ 行数表待与 §1.3 同步 |
| `file-container-refactor.md` | 文件容器验收 | 功能面 R2/R8 已关闭；索引性描述以 reviews 为准 |
| `docs/execution/reviews/README.md` | 批次审查与链路模拟 | 2026-05-25 已同步草稿/uid/波形 |
| `code-review-fix-2025-05-24.md` | 历史修复清单 | 归档参考 |
| `docs/architecture/stt-online-providers.md` | 在线 STT 真源 | 现行 |

---

*本报告基于 Oumi 调研与仓库对照审查修订。Part I 可指导排期；**P0 编码前须完成 auto-punctuate spec 三件套与后处理架构短文**。*
