# P1 在线 STT Provider：调研与解语式合约对齐

本文档回答两件事：**市面常用可 API 接入的 STT 有哪些、各适合什么场景**；以及 **Rushi 如何复用解语「外部 Provider」设计**（配置、可达性、密钥与 HTTPS 策略），与现有本机 `POST /v1/transcribe` 路径并存。

## 1. 调研：广泛使用的在线 STT（API 接入）

以下均为 **2025–2026 年常见生产选型**（批量转写、多语言、流式、生态成熟度综合），**非排名**，按场景选用。

| 厂商 / 产品 | 典型认证 | 批量 / 流式 | 特点摘要 |
|-------------|-----------|-------------|----------|
| **OpenAI**（Whisper-1 / `gpt-4o-mini-transcribe` 等） | `Authorization: Bearer` | 多为 **文件上传** 类 REST；部分新模型支持流式 | 语言覆盖广、接入简单、与 OpenAI 生态统一；注意区域与合规。 |
| **Google Cloud Speech-to-Text**（含 Chirp 系列） | OAuth2 / 服务账号 JSON | **流式 + 批量** | 多语言与方言强、可企业级治理（VPC-SC 等）；接入相对重。 |
| **Microsoft Azure Speech** | 区域 Key 或 Token | **流式 + 批量** | 企业采购常见、与 Azure 统一账单；SDK 成熟。 |
| **AWS Transcribe** | IAM / SigV4 | **批量为主**、流式有 Transcribe Streaming | 与 S3/Lambda 流水线天然结合。 |
| **Deepgram**（Nova 等） | `Authorization: Token` 或 Bearer | **流式强**、低延迟英语场景常见 | 开发者体验好、按量计费清晰。 |
| **AssemblyAI** | `Authorization` API Key | **流式 + 异步 Job** | 附加能力多（摘要、PII、说话人分离等），适合「转写 + 增值」。 |
| **Rev.ai**、**Speechmatics**、**Gladia** 等 | 各厂商 Key | 批量 / 流式各异 | 在媒体、合规、欧洲部署等细分场景常见。 |

### 1.1 国内与合规区常见 STT（API / 控制台形态）

以下侧重 **中国大陆节点、采购与备案** 语境；实际接口域名与版本以各云控制台为准。**多数**需 **AccessKey 签名、短期 Token 或 WebSocket**，与 P1 当前「单次 HTTP multipart」不完全同构，**推荐自建 HTTPS 网关** 归一为 Rushi `TranscriptionResult`。

| 厂商 / 产品 | 典型认证与形态 | 与 P1 对齐备注 |
|-------------|------------------|----------------|
| **阿里云百炼 DashScope（Qwen3-ASR）** | 百炼 API Key（`sk-…`）；`compatible-mode/v1/chat/completions` | 桌面壳直连；与 LLM 百炼 Key 相同；建议 ≤5 分钟/10MB。 |
| **阿里云智能语音交互（NLS）** | AppKey + `X-NLS-Token`；**非百炼 sk-** | 短音频 REST；长音频用录音文件识别或百炼 ASR。 |
| **腾讯云 ASR** | API 3.0 `TC3-HMAC-SHA256`（`asr.tencentcloudapi.com`） | 桌面壳已实现 **SentenceRecognition** 直连（SecretId 持久化 + SecretKey 内存）；亦可自建代理。 |
| **百度语音技术** | `access_token` 或 API Key；`vop.baidu.com` 等 | 桌面壳已实现 **server_api** 短音频路径（API Key 持久化 + Secret Key 内存）；长音频仍建议极速版或网关。 |
| **科大讯飞开放平台** | AppId + API Secret 签名 / WebSocket 听写 | 大模型识别线持续迭代，建议网关统一版本。 |
| **华为云 SIS** | 区域终端 + IAM Token / ProjectId | 与账号体系绑定紧，适合企业网关。 |
| **火山引擎（字节）语音识别** | AK/SK 签名、豆包语音等多产品线 | 控制台与 OpenAPI 字段以文档为准。 |
| **思必驰 AISpeech** | 合同与控制台为主 | 偏端侧/行业方案，多走商务集成。 |

**选型维度（与 Rushi P1 对齐时建议优先看）：**

1. **是否必须流式**：P1 当前是「整段音频 → 语段列表」的 **离线拉取**，首版在线 Provider 以 **异步/批量 REST** 即可对齐现有 UX。  
2. **输出形态**：能否稳定给出 **带起止时间的分句**（或至少词级时间戳便于后处理）；与现有 `TranscriptionSegment` / `schema_version: "1"` 对齐成本。  
3. **合规与密钥**：API Key **不得**写入 `localStorage` 明文；桌面端经 Tauri 写入 **OS 密钥库 / AppData 受保护文件**（`secrets/stt-online/`），前端 `localStorage` 仅保留 `apiKeyId` 引用，运行时按需读回会话内存。  
4. **网络与 CORS**：浏览器直连第三方常受 CORS 限制；**推荐**由 **Tauri 命令** 或 **本机 ASR 反向代理** 转发请求（与当前 `project_run_transcribe` 走 Rust `reqwest` 的思路一致）。

## 2. 复用解语的设计要点（映射到 Rushi）

解语在 `Jieyu/src/services/acoustic/acousticProviderContract.ts` 中对外部声学 Provider 已有一套可迁移的「壳」：

- **Provider 定义表**：`id` / `label` / `description` / `capabilities`（STT 可改为 `batch` / `streaming` / `diarization` 等）。  
- **运行时配置**：启用开关、`endpoint`、**`timeoutMs`**；对 **AppKey / ProjectId 等非根密钥** 可持久化（`rushi.stt.online.appKey`）。  
- **持久化策略**：`localStorage` 存非敏感项与 **`apiKeyId` 引用**；**根密钥 / Token** 经 Tauri `stt_save_api_key` 等命令写入本地受保护存储，重启后免填。  
- **安全基线**：外部 `endpoint` 仅允许 **HTTPS** 或 **本机 HTTP**（`isAllowedExternalProviderEndpoint`）。  
- **可达性探测**：`probeExternal*Health`（GET + 可选 Bearer，映射 HTTP 状态到 `available` / `401` / `timeout` 等）。  
- **解析态**：`requestedProviderId` vs `effectiveProviderId`、`fellBackToLocal`（Rushi 可映射为「请求在线 → 失败回退本机 ASR」）。

Rushi 已在 `apps/desktop/src/contracts/transcription.ts` 定义 **`TranscriptionProvider`** 与 **`TranscriptionResult`**；本机 HTTP 适配在 `apps/desktop/src/api/httpAsrProvider.ts`。在线多厂商应在 **同一结果契约** 上增加 **适配层**（各厂商 JSON → `TranscriptionResult`），而不是扩散多套 UI 类型。

## 3. 代码落位与接线状态

- `apps/desktop/src/services/stt/sttOnlineProviderContract.ts`：在线 STT 的 **定义表、运行时配置读写、HTTPS 校验、健康探测**（与解语 acoustic 合约同构，命名空间为 `rushi.stt.online.*`）。  
- `apps/desktop/src-tauri/src/stt_native/`：百炼 Fun-ASR（`dashscopeAsr`）、Deepgram（`deepgramListen`）等 **壳内直连** 与 `dispatch_native`。
- `apps/desktop/src-tauri/src/online_stt_bridge.rs`：`OnlineTranscribeBridge` 反序列化与 `transcribeUrl` 安全校验。
- 单元测试：`apps/desktop/src/services/stt/sttOnlineProviderContract.test.ts`（URL 策略与 `tryBuild` 载荷等）。在环境面板「在线 STT」保存 API Key 并探测通过后，主舞台「自动转录 → 在线」会调用 Tauri `project_run_transcribe`。载荷非空时：

- 选择 **OpenAI** 或 **AssemblyAI**：Rust 内建 **厂商原生 HTTP**（OpenAI `audio/transcriptions` + `verbose_json`；AssemblyAI v2 `upload` + `transcript` 轮询），再归一为 **`TranscriptionResult`（schema_version 1）**；URL 可留空以使用默认 `api.openai.com` / `api.assemblyai.com`。**术语表**（ACC-STT-UNIFY + ASR-VOC-3）：全局 `glossary_terms`（按 `updated_at_ms` 降序拼入）→ `SttVocabularyPlan` → OpenAI `prompt`（≤224 字）/ AssemblyAI `keyterms_prompt`（≤100 条）/ Deepgram `keywords`（≤50）；超长见 `online_vocabulary_truncated_*` warnings 与 `deriveTranscribeHints` 分型文案。
- 选择 **Deepgram**：壳直连 + **术语表** 映射为 URL `keywords`（ACC-STT-UNIFY）。
- 选择 **百炼 Fun-ASR（`dashscope-asr`）**：`fun-asr` **录音文件异步 Job**（临时 OSS 上传 → `file_urls` → 轮询 `tasks` → 解析 `sentences[]`）+ 术语库 → 百炼 `speech-biasing` 热词表（`vocabulary_id`，`target_model=fun-asr`）；见 ACC-STT-ALI。engine 标记为 `dashscope:fun-asr:file`。单文件上限与 AssemblyAI 同类（512MB 读入 guard）；轮询超时沿用在线转写 timeout（30–600s）。
- 上述 native adapter：`dashscopeAsr`（含热词）、`deepgramListen`（含热词）。**内置厂商转写 URL 已预置**；仅「自定义代理」需用户填写 POST URL。
- **自定义代理**：须配置 **与本机 rushi-asr 兼容的** `POST` 完整 URL（`multipart`：`file` + 可选 `hotwords`）；响应须已为 Rushi JSON 契约。若配置了持久化 **AppKey**，Tauri 会额外附带请求头 **`X-Rushi-Stt-App-Key`**，供网关读取后与厂商 API 组合。

> **已移除（2026-06）**：早期调研纳入的短窗口 REST/WebSocket 厂商（NLS、腾讯云一句话、百度短语音、讯飞听写、华为 SIS 短音频、思必驰 LASR、火山 WS、Azure 对话 v1 同步、Google v1 同步等）不适合口述史长音频，已从定义表与 Rust 壳内直连删除；旧 `selectedProviderId` 读取时自动迁移为 `dashscope-asr`。

未启用或载荷不完整时仍走本机 `asrBaseUrl + /v1/transcribe`。

### 3.1 在线分段与时间戳精度（Tier）

| Tier | 机制 | Rushi 行为 |
|------|------|------------|
| **A** | 云 API 词/句时间戳（AssemblyAI words/utterances、Deepgram words、OpenAI whisper-1 words、百炼文件 `sentences[]`） | `project/online_segment_normalize.rs` 统一 gap 切句；语段级可剪辑 |
| **C** | 标点 + 字符比例估算 | 仅当在线结果仍单段时 fallback；warning `online_segmentation_proportional` + UI hint |

实现 spec：[`online-stt-segment-unify-plan.md`](../execution/specs/online-stt-segment-unify-plan.md)。**不做** Sidecar forced alignment 为默认路径。

**可按需扩展**：OpenAI 模型名 UI、AssemblyAI 细粒度 Job 参数、Azure/Google 区域端点选择、各国内厂商长音频与模型版本选项。

## 4. 建议的首批 Provider 实现顺序（工程角度）

1. **OpenAI Audio Transcriptions**：已在 Tauri 以 `whisper-1` + `verbose_json` 打通（可再接 UI 模型选择）。  
2. **AssemblyAI**：已在 Tauri 以 v2 轮询打通；后续可加 webhook、附加分析字段。  
3. **Deepgram / 百炼 Fun-ASR**：已在 `stt_native` 以壳直连打通；长口述史仍优先本机 FunASR 或 AssemblyAI 异步 Job。

---

维护：若实现策略从「浏览器直连」改为「仅 Tauri」，请同步更新本文 §1 合规与 §3 接线说明。
