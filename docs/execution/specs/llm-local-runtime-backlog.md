# Backlog: 本机 LLM 校对（LLM-LOC）

> **状态**：**LLM-LOC-4a ✅**（2026-06-03）；**4b** 仍由 Gate-B 决定  
> **排期索引**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §6、§8.2 **Q-LLM**  
> **实施真源（LRC Phase 4）**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) §Phase 4  
> **后处理边界**：[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)（v1 远程；本机 loopback 须扩展 provider 边界）

---

## 1. 目标

个人单机用户在 **数据不出本机** 的前提下，用 LLM 完成 **R3t-C/D/E 同类校对**（标点 / 段界 / LexiconPack），与 **本机 ASR 侧车并列**，**不进** `rushi-asr` PyInstaller。

**v1（R9）**：仍以 **云端 OpenAI-compatible API** 签收 R3t。  
**v1 后**：**先 Spike + Gate（§9）**；**Gate 未过则不产品化**（保持云端默认 + 高级用户手动 loopback 实验）。

**默认产品策略（规划）**：

```text
主路径：云端 LLM（DeepSeek 等，R3t 签收）
本机 LLM：可选能力；仅 Gate 通过后写入环境页 Promote
不推荐：CPU-only 默认可用、全稿静默本地批校对、<16GB 与 ASR 同开无提示
```

---

## 2. 两条路线对比（拍板依据）

| 维度 | **4a — 接 Ollama** | **4b — LRC 自管 `llm-runtime`** |
|------|-------------------|----------------------------------|
| **谁管 LLM 进程** | 用户安装/自启 Ollama | 应用下载并拉起 llama-server 等 |
| **谁管模型** | `ollama pull` / Ollama UI | manifest 下载 GGUF → `llm-models/` |
| **与「零终端」** | 弱（多一个外部 App） | 强（对齐 R3f/R3h 一键准备） |
| **首版工程量** | ~0.5–1w | ~2–3w+（单平台 MVP） |
| **LRC 复用** | 几乎仅 postprocess + 环境页 | Installer / integrity / rollback 复用 R3h |
| **平台/GPU 矩阵** | Ollama 承担 | 自管承担（高） |
| **发版回归** | 用户 Ollama 版本不可控 | 钉死 runtime 版本 + smoke |
| **与 ASR 并行** | 两进程；无统一 Supervisor | 可纳入 R3h-I1（双 child） |
| **R3t 契约** | 同一 `postprocess_cmd` HTTP | 同左 |

**不做（两条均适用）**：

- LLM 进 ASR 侧车  
- Ollama **替代** ASR 引擎  
- 内置 LiteLLM 网关（路线图 §10）

---

## 3. 分阶段策略（已拍板 Q-LLM-1～3）

```text
R9 个人 v1（云端 LLM 签收 R3t）
    ↓
LLM-LOC-SPIKE   离线/半自动 eval + 延迟 + 同机资源（**仅规划与脚本，可无 UI**）  ← §9
    ↓  Gate-A 通过？
LLM-LOC-4a   Ollama 检测 + 环境灯 + postprocess loopback + R3t 共用 provider
    ↓  Gate-B 通过？
LLM-LOC-4b   LRC llm-runtime + llm-model manifest；应用内下载部署
    ↓
（可选）LLM-LOC-4c   推荐 quant / 显存不足降级；与 ASR 同屏占用提示
```

**未过 Gate**：Epic **保持 backlog**；不占用 §4.1.1 主序；云端仍为唯一推荐 provider。

**长期并存（Q-LLM-4）**：默认 **4b 零终端**；检测到已装 Ollama 时提供 **「使用现有 Ollama」** 快捷路径，跳过 4b 下载。

---

## 4. 子阶段说明

### 4.1 LLM-LOC-4a — Ollama（先验证）

| 项 | 内容 |
|----|------|
| **检测** | `127.0.0.1:11434`（或配置端口）；环境 **「本机 LLM」** 第三路灯扩展 |
| **配置** | postprocess `base_url` → `http://127.0.0.1:11434/v1`；**无 key** 或占位 key 就绪规则 |
| **隐私** | `provider_kind=local_loopback`：「数据不出本机」；非「发往云端」 |
| **能力** | probe + R2 标点；**R3t-C/D/E 签收后**接同一 provider |
| **依赖** | R3h-3 三盏灯 IA；R3t-E 契约稳定 |
| **验收** | Ollama 已 pull 模型：probe 成功；一条 R3t-E 手测（可 `@slow`） |

**预估**：0.5–1w

### 4.2 LLM-LOC-4b — LRC 自管 runtime

| 项 | 内容 |
|----|------|
| **组件** | `llm-runtime/{backend}/{version}/` + `llm-models/`（remediation §3.2） |
| **安装** | 复用 R3h-1/2：manifest、sha256、current+previous、rollback |
| **进程** | 应用拉起 llama-server（或选定 backend）；**不进** ASR 侧车 |
| **postprocess** | `base_url` 指向自管 loopback 端口 |
| **依赖** | **4a Go** 或产品书面跳过 4a；R3h-2 下载器稳定 |
| **验收** | 应用内完成 runtime+模型下载 → probe → R3t 校对；无必需 shell |

**预估**：2–3w（首平台）；跨平台 + GPU 后端另计

### 4.3 LLM-LOC-4c — 体验加固（可选）

- 与 ASR 合计磁盘/RAM 预警  
- 推荐 Q4/Q5 模型清单  
- **LLM-WARM**（类比 ASR-WARM）会话内保活  

---

## 5. R3t 实施纪律（v1 编码起生效）

1. 所有 LLM 命令走 **OpenAI-compatible** 单客户端（现有 `postprocess_cmd`）。  
2. 禁止写死「必须 HTTPS 公网」；loopback 已支持 `allow_insecure_http`。  
3. 隐私/UI 按 **`cloud | local_loopback | llm_runtime`** 分支，不写死云端文案。  
4. **不**为 Ollama/自管 fork R3t prompt 或 LexiconPack 契约。

---

## 6. 与现有代码

| 已有 | 缺口 |
|------|------|
| `postprocess_cmd` + loopback HTTP | Ollama 预设、无 key 就绪、本机 LLM 灯 |
| `PostprocessRuntimeBridge` | `provider_kind`、R3t 命令未编码 |
| LRC `local_runtime/`（ASR only） | `llm-runtime` catalog 类型未实现 |
| 环境页「LLM 配置」 | 文案仍为「远程」；无 Ollama 检测 |

---

## 8. 候选本机模型（规划参考，非签收）

> 用于 **LLM-LOC-SPIKE** 短名单；最终以 Gate 实测为准。不与 ASR 权重混装。

| 优先级 | 模型（Ollama 示例） | 适用任务 | 硬件粗估 | 规划判断 |
|--------|---------------------|----------|----------|----------|
| **S1** | `qwen2.5:7b` | R3t-C/E 首选试验 | 8GB 显存 / M 系 16GB+ | 速度/质量均衡 |
| **S2** | `qwen2.5:14b` | R3t-D/E（JSON/evidence） | 12GB+ 显存 / M 系 24GB+ | 质量↑，与 ASR 同机更挤 |
| **S3** | `twnlp/ChineseErrorCorrector-7B`（或同等 GGUF） | **仅** R3t-E 同音/错字 | 同 7B | 专精纠错；段界 JSON 另测 |
| **S4** | `qwen2.5:3b` / `1.5b` | 不推荐 R3t 主链 | 16GB 笔记本 | 仅作下限对照 |
| **延后** | `deepseek-r1:*` distill | 推理强，校对/JSON 未验证 | 12GB+ | Spike 可选对照 |

**同机资源（规划假设）**：FunASR 侧车 + 模型 **~4–8GB+**；7B Q4 LLM **~4.5GB+** → **16GB 机器需「转写/校对错峰」或明示 OOM 风险**。

---

## 9. 决策 Gate（后期是否「真上」）

### 9.1 Gate-A — 是否立项 **LLM-LOC-4a**（产品化 Ollama）

| # | 指标 | 建议阈值 | 测量方式 |
|---|------|----------|----------|
| G-A1 | **R3t-C** 标点可接受率 | ≥ 云端 DeepSeek **95%**（同 eval 集） | R4-GATE 扩展子集 + 人工抽检 20 段 |
| G-A2 | **R3t-E** evidence 可核对率 | ≥ **90%**；胡编 evidence **<5%** | 50 段 LexiconPack 手工核对 |
| G-A3 | **R3t-D** JSON ops 合法率 | ≥ **85%**（schema + 时间轴校验） | 30 组多段 fixture |
| G-A4 | 单次 R3t-E **P95 延迟** | ≤ **45s**（S1 模型，M 系或中端 GPU） | Spike 脚本记 `latency_ms` |
| G-A5 | **16GB** 同开 ASR+LLM | 不 OOM **或** 产品可接受「校对前释放 ASR」文案 | 手测 + 内存峰值记录 |
| G-A6 | 目标用户机器分布（若有） | ≥ **50%** 用户 ≥24GB 或独显 ≥8GB | 可选遥测/内测问卷 |

**通过**：写入路线图「立项 4a」+ 起草 `r3-llm-local-runtime-acceptance.md`。  
**不通过**：**不做 4a**；文档保留；云端默认不变。

### 9.2 Gate-B — 是否立项 **LLM-LOC-4b**（LRC 自管）

**前置**：Gate-A **已通过**，或产品书面 **跳过 4a**（需记录原因）。

| # | 指标 | 建议阈值 |
|---|------|----------|
| G-B1 | 内测反馈「不愿另装 Ollama」 | 成为 Top 阻碍 **或** 4a 版本碎片导致支持成本过高 |
| G-B2 | LRC 下载/回滚 | R3h-2 已在 ASR 上稳定签收 |
| G-B3 | 4b MVP 首平台 smoke | llm-runtime + 模型 → probe → 1 条 R3t-C **自动化** |

**不通过**：长期 **4a + 云端** 双轨即可，不做 4b。

### 9.3 任务级规划结论（先验，Spike 可修正）

| 任务 | 本地 7B 预期 | Spike 重点 |
|------|--------------|------------|
| R3t-C 标点 | 多半可用 | G-A1、G-A4 |
| R3t-D 段界 | 风险较高 | G-A3 |
| R3t-E LexiconPack | 字准可、evidence 纪律难 | G-A2；可选 S3 对照 |

---

## 10. LLM-LOC-SPIKE（规划薄片，Gate 前）

> **不占 v1 主序**；可在 **R3t-E 编码完成后、4a 编码前** 用脚本/本地 Ollama 执行。  
> **交付物**：Markdown 结论 + 数值表；**不要求** 环境页 UI。

| 步骤 | 内容 | 产出 |
|------|------|------|
| S1 | 固定 **eval 子集**（20～50 段中文口述 + glossary + memory rules） | `docs/execution/fixtures/llm-loc-eval/` 或复用 R4 集 |
| S2 | 云端 **DeepSeek** 基线跑 R3t-C/D/E prompt（或 R3t 实现后同命令） | baseline JSON |
| S3 | Ollama **S1/S2**（+ 可选 S3）同 prompt | local JSON |
| S4 | 对比：可接受率、JSON 合法率、evidence、P50/P95 延迟 | Gate 表填写 |
| S5 | **同机**：ASR 转写 13min 后立即本地 R3t-E ×3，记峰值 RAM | G-A5 证据 |
| S6 | **书面结论**：Go 4a / No-Go / 仅保留 hidden loopback | 记入 §8.2 **Q-LLM-5** |

**预估**：2～4d（单人）；可与 R4-GATE 数据集建设合并。

---

## 11. 文档与 acceptance（Gate 通过后）

| 文档 | 状态 |
|------|------|
| `r3-llm-local-runtime-acceptance.md` | **Gate-A 通过后** 起草 |
| `postprocess-provider-boundary.md` 或扩展 remote-boundary §7 | Gate-A 通过后 |
| 可选 ADR | Gate-B 前（4a/4b 并存） |

---

## 12. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-27 | 初版：4a/4b 对比；分阶段 Q-LLM；并入路线图 §6 |
| 2026-05-27 | **仅规划**：§8 模型短名单；§9 Gate-A/B；§10 SPIKE；未过 Gate 不产品化 |
