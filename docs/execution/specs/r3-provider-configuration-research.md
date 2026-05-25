# R3 调研：LLM / STT 等模型的 Provider 配置与业内共识

> **状态**：规划门禁（2026-05-25）  
> **目的**：为 R3（EXP-1 模型与配置体验）提供「先调研、后编码」的真源；**不**引入 LiteLLM 等重型网关进桌面安装包。  
> **关联**：[`stt-online-providers.md`](../../architecture/stt-online-providers.md)、[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §R3。

---

## 1. 结论摘要（给决策者）

| 问题 | 业内共识 | Rushi 建议 |
|------|----------|------------|
| 要不要统一「大模型网关」？ | **LLM** 侧普遍用 **OpenAI-compatible 统一面**（直连或自建 LiteLLM/Portkey 等）；**STT** 无同等单一标准，多为 **厂商原生 API + 适配层** | **不**在 v1 桌面壳内嵌 LiteLLM；**是**在应用内复用「Provider 定义表 + 运行时配置 + 密钥分层 + 健康探测」同一套 *模式* |
| 配置放哪？ | 非密钥 → profile/YAML/DB；密钥 → OS Keychain / 环境变量 / 企业密钥服务；**永不**进 repo | R3 落地 **`profile` 导出（无 secret）** + **keychain `api_key_id`**；与现有 STT/LLM UI 对齐 |
| 模型列表怎么管？ | **预设厂商 + 默认 model** + 用户可改；动态 model catalog 为增强项 | 维持 **静态 `modelExamples` + 可编辑 model 字段**；不做全量 model 拉取（除非单厂商明确提供轻量 list API） |
| STT 与 LLM 能否共用一套 Provider？ | **不能共用同一 HTTP 契约**；可共用 **配置 UX 与密钥纪律** | 保持 **两条运行时通道**：`sttOnlineProviderContract`（音频）与 `llmRuntimeContract`（Chat Completions），UI 上可同在「环境/设置」 |

---

## 2. 能力分类：三种不同的「模型调用」

桌面端 Rushi 至少有三类出站能力，**配置模型相似、协议不同**：

```text
┌─────────────────────────────────────────────────────────────────┐
│                        用户可见「环境 / 设置」                    │
├─────────────┬──────────────────────┬────────────────────────────┤
│ 本机 ASR     │ 在线 STT（实验）      │ LLM 配置（后处理）          │
│ FunASR 侧车  │ 15+ 厂商 / 代理       │ OpenAI-compatible Chat    │
│ 本地模型路径  │ 音频 multipart/WS    │ 文本 messages + model     │
└─────────────┴──────────────────────┴────────────────────────────┘
         ▲                    ▲                      ▲
         │                    │                      │
   模型文件 + manifest    Provider 表 + bridge    Provider 表 + bridge
   无云 API Key           密钥分层 + probe          密钥分层 + probe
```

### 2.1 本机 ASR（非 API Provider）

- **真源**：`services/asr` 侧车、`usePrepareModelController`、`EnvLocalAsrPanel`。
- **配置对象**：模型 id、缓存目录、设备（CPU/GPU）、manifest 校验——**不是** cloud provider。
- **R3 范围**：首次引导、缓存占用/清理、manifest **结果展示**（路线图已列）。

### 2.2 在线 STT（多厂商原生 / 代理）

- **真源**：[`stt-online-providers.md`](../../architecture/stt-online-providers.md)、`sttOnlineProviderContract`、`stt_native` / `china_stt_shell`。
- **协议形态**（无统一标准）：
  - OpenAI / AssemblyAI：`audio/transcriptions` 或异步 Job
  - 国内云：TC3 签名、OAuth Token、WebSocket 听写等
  - **自定义代理**：归一为 Rushi `TranscriptionResult` JSON + multipart `file`
- **已支持厂商（定义表 id）**：`openai`、`assemblyai`、`deepgram`、`google-cloud-stt`、`azure-speech`、`aliyun-nls`、`tencent-asr`、`baidu-speech`、`iflytek-speech`、`huawei-sis`、`volcengine-speech`、`aispeech`、`custom-proxy` 等。

### 2.3 LLM 后处理（OpenAI-compatible 占主导）

- **真源**：[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)、`postprocess_cmd`、`llmRuntimeContract`。
- **协议**：`POST /v1/chat/completions`（或兼容变体），`Authorization: Bearer`。
- **已支持预设**：DeepSeek、Kimi（Moonshot）、Qwen（阿里百炼）、SiliconFlow、火山方舟（Doubao）、OpenAI、OpenRouter；其余 OpenAI-compatible 厂商仍可继续按「定义表行 + 默认 `base_url/model`」扩展。

---

## 3. 业内常见配置模型（抽象层）

无论 LiteLLM、Portkey、LangChain、Vercel AI SDK 还是各云控制台，收敛到同一套 **四层结构**：

| 层 | 内容 | 持久化 | 示例 |
|----|------|--------|------|
| **Provider 定义（catalog）** | `id`、`label`、能力标签、默认 endpoint、文档链接 | 代码或只读 JSON | `deepseek` → `https://api.deepseek.com/v1` |
| **运行时配置（runtime）** | 启用开关、选定 provider、endpoint 覆盖、model、timeout、区域 | localStorage / profile YAML / SQLite | `rushi.llm.model=deepseek-chat` |
| **密钥（credentials）** | API Key、Token、AK\|SK 组合 | **Keychain** 或会话内存；导出 profile **必须剥离** | `api_key_id: "deepseek-main"` |
| **可达性（probe）** | 轻量请求验证 Key/网络/配额 | 无 | GET `/models` 或最小 chat/health |

### 3.1 LLM：行业通用解

1. **OpenAI-compatible 作为 lingua franca**  
   应用只认 `base_url + api_key + model`；换厂商往往只改 base_url（[LiteLLM](https://docs.litellm.ai/) 等网关即把 100+ 厂商映射到该形态）。

2. **Gateway 模式（可选、常自建）**  
   - **LiteLLM Proxy**：统一 OpenAI 面、fallback、计费、限流（适合平台团队）。  
   - **Portkey / Helicone 等**：托管或半托管，偏观测与治理。  
   - **桌面单机应用**：通常 **直连厂商** 或 **用户自建网关 URL**（在 base_url 填 `http://127.0.0.1:4000/v1`），**不应**捆绑安装网关。

3. **主流 Chat 模型（2025–2026，按兼容面归类）**

   | 类别 | 代表 model id（示例） | 备注 |
   |------|----------------------|------|
   | OpenAI | `gpt-4o`、`gpt-4o-mini` | 事实标准参考实现 |
   | Anthropic | 多通过网关或 `anthropic/` 路由 | 原生 API 非 OpenAI 形，直连需单独 adapter |
   | DeepSeek | `deepseek-chat`、`deepseek-reasoner` | 已接入 Rushi |
   | Moonshot / Kimi | `moonshot-v1-8k`、`kimi-k2-*` | 已接入 Rushi |
   | 阿里百炼 compatible | `qwen-*` 系列 | 常给 OpenAI 兼容 base |
   | Google | Gemini 多走 Vertex 或 OpenAI 兼容代理 | |
   | 本地 | Ollama `llama3` 等 | loopback HTTP，开发/隐私场景 |

4. **共识纪律**  
   - 密钥不进 git、不进导出包。  
   - UI 明示「文本出站」与 provider 名称。  
   - 超时、取消、错误映射为用户可读文案（非 stack）。

### 3.2 STT：行业通用解

1. **无单一 OpenAI 式标准**  
   STT 厂商 API 差异大（multipart 上传、异步 Job、WebSocket 流式、云签名）。业内做法是：
   - **适配器 per vendor**（Rushi：`stt_native` + `china_stt_shell`），或  
   - **自建归一化网关**（Rushi：`custom-proxy` → 统一 JSON）。

2. **配置字段共性**  
   - `endpoint`（或区域）  
   - `appKey` / `projectId` 等 **可持久化标识**  
   - **根密钥仅内存**（与 Jieyu acoustic 合约一致）  
   - `timeoutMs`、可选 `model`/`language`

3. **Rushi 已走的路径 = 解语式外部 Provider 合约**  
   定义表 + storage + inMemorySecrets + HTTPS 校验 + `probeExternalSttOnlineHealth` —— 这是 **应用内通用解**，不依赖第三方网关。

---

## 4. 常见产品形态对比（是否适合 Rushi 桌面壳）

| 方案 | 适用场景 | 优点 | 对 Rushi 的风险 |
|------|----------|------|----------------|
| **应用内 Provider 表 + Tauri 出站**（当前） | Electron/Tauri 桌面、离线优先 | 包体小、信任边界清晰、与 Keychain 自然集成 | 每增厂商要写 adapter（STT） |
| **LiteLLM / 同类网关** | 多服务、多团队共用 | 100+ LLM、fallback、计费 | 额外进程、运维、许可证与体积；**不适合打进侧车** |
| **仅 OpenAI SDK 多 base_url** | 只要 LLM、厂商均兼容 | 实现极简 | STT 无法覆盖；Anthropic 等需另写 |
| **LangChain 等框架** | 复杂 Agent 流水线 | 编排强 | 过重；Rushi 仅需单次 chat |
| **云控制台配置同步** | 企业租户 | 集中治理 | 超出 R3；协作远期 |

**Rushi ADR 级取舍（已存在）**：

- LLM **不进** ASR PyInstaller 侧车（[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)）。  
- **不做** 统一 `InferenceEngine`（路线图 §8）。  
- STT 与 LLM **密钥通道分离**（可同页 UI，不同 storage/keychain service）。

---

## 5. Rushi 现状对照

| 维度 | 在线 STT | LLM（后处理） | 本机 ASR |
|------|----------|---------------|----------|
| 定义表 | `STT_ONLINE_PROVIDER_DEFINITIONS`（13+） | `LLM_PROVIDER_DEFINITIONS`（2） | FunASR model id / env |
| 运行时 storage | `rushi.stt.online.*` | `rushi.llm.*` | 侧车 env + 本地目录 |
| 密钥 | 内存 `inMemorySttSecrets` | 内存 `inMemoryLlmSecrets` | 无云密钥 |
| 出站实现 | Rust `stt_native` + bridge | Rust `postprocess_cmd` | Python 侧车 HTTP |
| UI | `EnvOnlineSttPanel` | `EnvLlmConfigPanel` | `EnvLocalAsrPanel` |
| Probe | ✅ `probeExternalSttOnlineHealth` | ❌ 待 R3 | `/health` 已有 |
| Profile 导出 | ❌ 路线图 R3 | ❌ 路线图 R3 | 部分 env |

**已验证**：R2 自动标点 + DeepSeek；GLY-1 术语库 + 转写热词（用户手测 2026-05-25）。

---

## 6. R3 推荐目标架构（规划，非立即编码）

### 6.1 原则

1. **扩展「配置体验」，不替换调用链**。  
2. **统一纪律，不强行统一协议**。  
3. **Profile 只含非密钥；密钥只走 keychain + `api_key_id`**。  
4. **UI 可合并为「模型与 API」大节**，底下分栏：本机 ASR | 在线 STT | LLM。

### 6.2 建议的配置 schema（`profile` v1 草案）

```yaml
# 示例：导出时 strip 所有 *_api_key* / secrets
version: 1
local_asr:
  models_root: "..."
  default_model_id: "paraformer-zh"
online_stt:
  enabled: false
  provider_id: openai
  endpoint: null
  timeout_ms: 120000
  app_key: null          # 可持久化
  # api_key → 仅 keychain: rushi.stt.online / id
llm:
  provider_id: deepseek
  base_url: https://api.deepseek.com/v1
  model: deepseek-chat
  # api_key_id → keychain: studio.lingchuang.rushi.postprocess / deepseek-main
```

实现落位（路线图原意）：

- Rust：`profile.rs` 读写 YAML/JSON，校验版本，拒绝 secret 字段。  
- TS：从现有 `read*FromStorage` 双向同步或迁移一次。

### 6.3 LLM Provider 扩展策略（轻量）

| 优先级 | 厂商 | 方式 |
|--------|------|------|
| P0 | DeepSeek、Kimi | ✅ 已有 |
| P1 | Qwen（阿里百炼）、SiliconFlow、火山方舟（Doubao）、OpenAI、OpenRouter | 仅加 `LLM_PROVIDER_DEFINITIONS` 行 + 文档 |
| P2 | 用户自定义 base_url（兼容网关 / 自建代理） | 已有字段，直接编辑 `base_url` + `model` |
| 不做 | Anthropic 原生 Messages API | 需第二 adapter，非 OpenAI 形 |

**可选增强（R3 薄片，不阻塞）**：

- keychain 读写 Tauri 命令（`llm_save_api_key` / `llm_probe`）  
- Probe：对 OpenAI-compatible 发 `GET /v1/models` 或 1-token chat（注意计费）

### 6.4 STT：R3 不扩厂商，只扩「配置产品化」

- 不新增 STT 厂商（已 13+，维护成本够高）。  
- 做：与 profile 同步、probe 结果展示优化、首次引导指向在线 STT 实验说明。  
- 长期：考虑「STT 也用 keychain」与 LLM 同 service 名空间分 account。

### 6.5 明确不做（R3）

- 内置 LiteLLM / Portkey 进程。  
- 动态拉取全量 model 列表（除非单厂商官方 list API 稳定且免费）。  
- 把 STT 与 LLM 合并为一条 Rust HTTP 客户端以外的「超级 Provider 接口」。  
- YAML 作为**唯一**真源（profile 是导出/备份格式，运行时仍以 storage + keychain 为主）。

---

## 7. R3 实施薄片建议（调研后的排期）

在 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) 原 R3 条目上，建议拆为：

| 薄片 ID | 主题 | 依赖 | 验收 |
|---------|------|------|------|
| **R3a** | LLM keychain + probe | 无 | Key 重启后仍可用；探测显示可达/401 |
| **R3b** | `profile.rs` 导入导出（无 secret） | R3a schema 草案 | 往返不丢非密钥项；含 secret 拒绝导入 |
| **R3c** | 本机 ASR：首次引导 + 缓存/manifest UI | 无 | 新用户能完成模型准备路径 |
| **R3d** | 设置 IA：「模型与 API」分组文案 | R3a–c | 三栏职责清晰，不重复造下载 UI |

**建议实施顺序**：`R3a → R3b → R3c → R3d`（先打通 LLM 配置闭环与 profile，再做本机体验与信息架构）。

---

## 8. 开源参考（实现时查阅，非依赖）

| 项目 | 可借鉴点 |
|------|----------|
| [LiteLLM](https://github.com/BerriAI/litellm) | Provider 映射表、OpenAI 错误归一、proxy 配置形态 |
| OpenAI SDK | `base_url` + `api_key` 覆盖模式 |
| 本仓 `sttOnlineProviderContract` | 密钥分层、HTTPS 策略、probe 状态机 |
| Jieyu `acousticProviderContract` | 外部 Provider 合约起源 |

---

## 9. 门禁

- [x] 调研结论写入本文（R3 规划门禁）  
- [x] 已确认：**不**引入 LiteLLM 捆绑；**STT/LLM 分通道**（2026-05-25）  
- [x] 已确认薄片顺序：**R3a → R3b → R3c → R3d**  
- [x] R3a acceptance：[`r3a-llm-keychain-probe-acceptance.md`](./r3a-llm-keychain-probe-acceptance.md)（R3b+ 实施前再补）

---

## 10. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-25 | 初版：业内 LLM/STT Provider 配置调研 + Rushi R3 规划建议 |
| 2026-05-25 | 门禁关闭；链至 R3a acceptance |
