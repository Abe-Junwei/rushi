# 调研：本机开源 LLM 选型（2026）— 中文后处理与导出润色

> **状态**：规划门禁（2026-06-04）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §LLM-LOC、EXP-WORD  
> **前置调研**：[`llm-loc-spike-research.md`](./llm-loc-spike-research.md)、[`llm-loc-spike-results-2026-06.md`](./llm-loc-spike-results-2026-06.md)、[`r3-provider-configuration-research.md`](./r3-provider-configuration-research.md)  
> **关联 spec（编码前须链接本文）**：`local-llm-model-catalog-update-intent.md`（待 Gate 后起草）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 桌面端 Rushi 在 **本机 Ollama** 上跑 LLM 后处理：自动标点（R3t-C）、段界整理 JSON（R3t-D）、词表校对（R3t-E）、**交付导出润色**（EXP-WORD，569 行 JSON `lines` + `break_after_line`）。用户希望数据不出本机，且长稿导出不被截断。 |
| **本仓现状** | 默认 `qwen2.5:7b`（[`llmProviderCatalog.ts`](../../../apps/desktop/src/services/postprocess/llmProviderCatalog.ts)）；loopback 走 `POST /v1/chat/completions` + `format: "json"`（[`postprocess_export_polish_cmd.rs`](../../../apps/desktop/src-tauri/src/postprocess_export_polish_cmd.rs)）。Spike 仅签收 **R3t-C + qwen2.5:7b**（P95 916ms，改词率 7/30 vs 云端 1/30）。导出润色 569 行在本机 **JSON 截断**（`finish_reason=length` / 无闭合 `}`）。 |
| **成功标准** | ① 在目标硬件档位上，R3t-C 延迟 P95 ≤45s、可接受率 ≥ 云端 95%（G-A1）；② 导出润色 500+ 行 **JSON 可解析率 ≥90%** 或产品明确分批策略；③ 不引入第二套 LLM 运行时（仍 Ollama loopback）。 |

### 1.1 Rushi 对模型的硬约束（非通用 Chat 场景）

| 维度 | 要求 |
|------|------|
| **语言** | 中文口述 / ASR 纠错为主；英数专名保留 |
| **输出形态** | 严格 JSON（长数组、camelCase/snake_case 混用需容错）；**忌** reasoning/thinking 包裹 |
| **上下文** | 单次 export polish：~6K 字输入 + **569 行 JSON 输出**（约 1.5万–2.5万 token 量级） |
| **延迟** | 标点：秒级；导出润色：分钟级可接受（已设 loopback 120–900s 超时） |
| **协议** | Ollama OpenAI-compatible；**不** bundled vLLM/Transformers（ADR：[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)） |
| **许可** | 桌面分发倾向 **Apache 2.0 / MIT**；Llama 社区许可有 MAU 门槛 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| **A** | **Qwen 系（阿里）** | Qwen2.5 / **Qwen3** dense + MoE；Ollama `qwen3:8b`、`qwen3:30b-a3b` | 119 语言预训练；Qwen3 同参优于 Qwen2.5；MoE 在 24GB 上接近 70B 体验；Ollama 支持 JSON Schema 约束 | [Qwen3 博客](https://qwenlm.github.io/blog/qwen3/)、[Ollama qwen3](https://ollama.com/library/qwen3) |
| **B** | **DeepSeek 系** | DeepSeek-V3 / **R1** distill；Ollama `deepseek-r1:14b` | 推理 / 数学 SOTA；R1 带 chain-of-thought，**与 JSON mode 互斥或污染输出** | [DeepSeek](https://github.com/deepseek-ai)、[ToolHalla 2026 对比](https://toolhalla.ai/blog/deepseek-vs-llama-vs-qwen-2026) |
| **C** | **Meta Llama 4 / 3.x** | `llama3.1:8b`、`llama4:scout` | 生态最大；**中文 ASR 后编辑弱于 Qwen**；Scout 109B MoE 需 ~55GB+ VRAM | [InsiderLLM 2026 本地对比](https://insiderllm.com/guides/llama-4-vs-qwen3-vs-deepseek-v3-2-local/) |
| **D** | **中文专精纠错小模型** | `twnlp/ChineseErrorCorrector-7B` 等 | 专精同音错字；**无**段界 JSON / 长数组 export 能力 | 见 [`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md) §8 S3 |
| **E** | **Ollama 结构化输出（基础设施）** | `format: { JSON Schema }`（v0.5+） | Grammar 约束 token；**仍可能**在中途 stop 导致 JSON 不完整 | [Ollama Structured Outputs](https://ollama.com/blog/structured-outputs)、[Daniel Clayton 原理说明](https://blog.danielclayton.co.uk/posts/ollama-structured-outputs/) |

---

## 3. 可复用评估

### 3.1 模型族 × Rushi 任务

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **Qwen3 8B** | **高** | Ollama pull；替换 catalog 默认；R3t-C 同 prompt | 32K 上下文与 Qwen2.5 同级；长 export 仍可能满窗 | Q4 ~5–6GB；M 系 16GB / 独显 8GB 可跑；比 2.5:7b 略慢 |
| **Qwen3 30B-A3B（MoE）** | **高** | 24GB 档「质量首选」；active 3B → 速度接近 8B | 32K 默认 context（与 2.5 相同量级） | Q4 ~18GB；**与 FunASR 侧车同机需错峰** |
| **Qwen2.5 14B** | **中** | 已列 catalog example；中文强于 7B | JSON 长输出仍受 32K 限制 | Q4 ~9GB；24GB 机器与 ASR 争抢 |
| **Qwen3 4B / 2.5 3B** | **低** | 极弱机 fallback | Spike：`qwen3.5:4b` **超时**（见 `spike-output/llm-loc-ollama-qwen3.5-4b-2026-06-03.json`） | 快但不稳 |
| **DeepSeek R1 distill** | **低** | 复杂推理对照 | **thinking 与 JSON 冲突**；export polish 已观测 `` 包裹 | 14B ~9GB；不适合默认 |
| **Llama 3.1/4 8B–17B** | **低** | 英文 / 工具链 | 中文 ASR 纠错、口语噪声处理 **明显弱于 Qwen**（多语 benchmark 中文 ~81% vs Qwen ~97%） | Scout 需 55GB+ |
| **ChineseErrorCorrector-7B** | **中（仅 E）** | R3t-E 错字专精 spike | **不能**承担 export JSON / 段界 ops | 与 7B 同 VRAM；第二模型切换成本 |
| **JSON Schema（Ollama）** | **高** | 改 `postprocess_export_polish_cmd` 的 `format` 字段 | 不解决 **max_tokens / context 截断** | 无额外内存 |

### 3.2 本仓已有可复用模块（必须先列）

- **Loopback 通道**：`postprocess_cmd` + `postprocess_http`（no_proxy、超时、`max_tokens` 估算）
- **Provider catalog**：`llmProviderCatalog.ts`（`OLLAMA_DEFAULT_MODEL`、`modelExamples`）
- **Spike 脚本**：`scripts/llm-loc-spike-run.py`（可扩展 task=export_polish）
- **JSON 解析容错**：`postprocess_segment_ops.rs`、`postprocess_export_polish.rs`（fence / 截断诊断）
- **云端 fallback**：DeepSeek 等已验证 export polish 176 行成功（用户 `desktop.log`）

### 3.3 实测与文献摘要（2026-06）

**本机 Ollama（用户环境 `qwen2.5:7b`）**

- `context_length`: **32768**（`ollama show` / `/api/tags`）
- `format: json` 时 `message.content` 仍为 **字符串**，常带 `` ```json ... ``` ``（非纯 object）
- 569 行 export：`parse_json` 失败，snippet 以 `` ```json {"lines":[... `` 开头且无闭合 — **输出 token 截断**

**Ollama 对照实验（同机 curl）**

- `max_tokens: 100` → `finish_reason: length`，`{` 1 个、`}` 0 个 → 复现「未找到 JSON 对象」
- 小请求完整响应：`"content": "```json\n{...}\n```"`

**LLM-LOC Spike（2026-06-03，R3t-C 30 段）**

| 模型 | P95 | 错误 | 备注 |
|------|-----|------|------|
| `deepseek-chat`（云） | 1183 ms | 0 | 基线 |
| `qwen2.5:7b` | **916 ms** | 0 | 83.3% 自动相似度 ≥0.85 |
| `qwen3.5:4b` | — | 2/2 timeout | 不推荐默认 |

**第三方 2026 综合对比（文献，非 Rushi 复跑）**

| 模型 | 中文 | 编码/JSON 纪律 | 24GB 档性价比 | 许可 |
|------|------|----------------|---------------|------|
| **Qwen3-30B-A3B** | ★★★★★ | ★★★★☆ | **最佳** | Apache 2.0 |
| **Qwen3-8B** | ★★★★★ | ★★★★☆ | 8–12GB 档首选 | Apache 2.0 |
| Qwen2.5-7B（现默认） | ★★★★☆ | ★★★☆☆ | 基线 | Apache 2.0 |
| DeepSeek R1-14B | ★★★★☆ | ★★☆☆☆（thinking） | 推理强、JSON 弱 | MIT |
| Llama 4 Scout | ★★★☆☆ | ★★★☆☆ | 需 55GB+ | Llama 4 Community |

> 引用：[Premai Qwen3 vs Llama3 本地部署](https://blog.premai.io/qwen-3-vs-llama-3-for-local-deployment-which-model-what-hardware-and-when-to-skip-diy/)、[InsiderLLM Llama4 vs Qwen3](https://insiderllm.com/guides/llama-4-vs-qwen3-vs-deepseek-v3-2-local/)、[ToolHalla 2026 三家对比](https://toolhalla.ai/blog/deepseek-vs-llama-vs-qwen-2026)

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案（分档）** | **仍选 Qwen 系**；在 Ollama 上按 VRAM **升级代际**，而非换 Llama/DeepSeek R1：<br>• **8–12GB**：`qwen3:8b` 替代 `qwen2.5:7b`（默认可选）<br>• **24GB**：`qwen3:30b-a3b`（质量/速度最佳）<br>• **12–16GB 要质量**：`qwen2.5:14b` 或 `qwen3:14b`<br>• **export 500+ 行**：**模型 + 产品分批**（见下） |
| **32K 是极限吗？** | **对当前 Qwen2.5/3 默认 Ollama 档位：是「输入+输出合计」约 32K token 的上限**；不是 Rushi 人为限制。更大窗口（128K）需换 **长上下文变体** 或调 `num_ctx`（吃 RAM）。Export 569 行的问题 **首先是输出 quota 截断**，其次才是 32K 满窗。 |
| **不做什么** | ① 不在 v1 内 bundled llama.cpp/vLLM（LLM-LOC-4b 仍 Gate-B）；② 不把 **DeepSeek R1** 作默认（JSON/thinking 冲突）；③ 不用 **Llama** 作中文 ASR 后处理默认；④ 不指望 **4B/3B** 承担 export polish；⑤ 不在本调研内启动 **Qwen3-ASR**（R3g-B 已 No-go，见 [`r3g-b-qwen3-asr-sku-spike-research.md`](./r3g-b-qwen3-asr-sku-spike-research.md)） |
| **与 ADR / architecture** | 符合 [`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md) loopback 边界；扩展 [`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md) §8 短名单，**不**新增第二 HTTP 栈 |
| **风险与 spike 项** | ① Qwen3 改词率 vs 2.5:7b 未复跑 G-A1；② export polish 500+ 行需 **新 spike**（qwen3:8b / 30b-a3b + JSON Schema）；③ 24GB 同开 ASR+30B MoE 仍可能 OOM（G-A5） |

### 4.1 推荐默认（产品文案级）

| 硬件档位 | 推荐 Ollama 模型 | 适用 Rushi 任务 | 备注 |
|----------|------------------|-----------------|------|
| 16GB 统一内存 / 8GB 独显 | **`qwen3:8b`**（pull 后选） | R3t-C ✅；短稿 export（&lt;200 行）可试 | 替换 `qwen2.5:7b` 为 **首选示例** |
| 24GB 独显 / M Pro 24GB+ | **`qwen3:30b-a3b`** | R3t-C + **中长稿 export** | 同机 ASR 时先释放侧车或排队 |
| 12GB 独显 | `qwen3:8b` 或 `qwen2.5:14b` | R3t-C；export 谨慎 | 14B 更慢、更挤 |
| 仅 8GB 且已装 2.5:7b | 保留 **`qwen2.5:7b`** | R3t-C | 升级 3:8b 前手测 RAM |
| 云端 / 长稿 export | **DeepSeek / Kimi**（已有） | export 500+ 行、段界、词表 | **仍作默认推荐** |

| 4.2 比换模型更重要的产品/工程项（与模型正交）

1. **已实现**：按行数设 `max_tokens`（569 行 → 28000）  
2. **已实现**：export polish **分批**（>200 行 → 每批 180 行，Rust 侧自动 merge）  
3. **待做（高 ROI）**：loopback 请求 `format` 改为 **JSON Schema**  
4. **待做（验证）**：扩展 `llm-loc-spike-run.py` → task `export_polish`  

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| TS catalog | `llmProviderCatalog.ts` | 更新 `OLLAMA_DEFAULT_MODEL` 候选、`modelExamples`（qwen3 系列）、描述文案 |
| UI | `EnvLlmConnectionForm.tsx` | 推荐语「qwen3:8b / 24GB 用 30b-a3b」 |
| Rust | `postprocess_export_polish_cmd.rs` | JSON Schema `format`；可选 `think: false`（Qwen3） |
| Rust | `postprocess_http.rs` | `max_tokens` 与 `num_ctx` 提示（文档级） |
| Spike | `scripts/llm-loc-spike-run.py` | 增加 export_polish fixture |
| 文档 | `llm-local-runtime-backlog.md` §8 | 刷新 S1–S4 短名单 |
| 测试 | `postprocess_export_polish*.rs` | Schema 路径单测 |

---

## 6. 签收

- [x] 调研 brief 完成（2026-06-04）
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入 catalog 更新与 export spike

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对照 Qwen3 / DeepSeek R1 / Llama4；结合用户 Ollama 实测与 desktop.log；分档推荐 |
