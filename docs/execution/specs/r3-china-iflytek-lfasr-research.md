# R3 调研：讯飞开放平台长音频语音转写（LFASR）原生接入

> **状态**：规划门禁（2026-06-18 补全门禁章节）  
> **目的**：为国内在线 STT 补齐讯飞长音频转写原生支持，达到当前阿里云百炼 Fun-ASR（`dashscope-asr`）的同等级集成深度：Provider 定义表 + Rust Native Adapter + 异步 Job 轮询 + 归一化 `schema_version: 1` 结果。  
> **关联**：[`stt-online-providers.md`](../../architecture/stt-online-providers.md)、[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §R3、[`CONTEXT.md`](../../../CONTEXT.md)。  
> **下游 spec**：[`acc-stt-iflytek-plan.md`](./acc-stt-iflytek-plan.md) · [`acc-stt-iflytek-acceptance.md`](./acc-stt-iflytek-acceptance.md) · [`acc-stt-iflytek-hand-test-checklist.md`](./acc-stt-iflytek-hand-test-checklist.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史 / 方言采集用户已开通**讯飞开放平台**（AppID + APIKey + APISecret），希望长音频（≥5 min、≤5 h）在桌面端走**在线 STT** 且与百炼同级体验：环境页配置 → 探测 → 主舞台异步 Job → 多语段 + 术语库偏置；部分用户需要 **202 方言免切** 或已有讯飞配额/采购，不便迁移百炼 sk-。 |
| **本仓现状** | 国内在线 STT 定义表当前仅 **`dashscope-asr`**（百炼 Fun-ASR 文件 Job，[`dashscope_file_asr.rs`](../../../apps/desktop/src-tauri/src/stt_native/dashscope_file_asr.rs)）；早期 **`iflytek-speech`**（短窗口听写）已于 2026-06 从定义表移除并迁移至百炼（[`runtimeConfig.ts`](../../../apps/desktop/src/services/stt/sttOnlineProviderContract/runtimeConfig.ts) `REMOVED_SHORT_WINDOW_STT_PROVIDER_IDS`）。无讯飞长音频 native adapter；Provider 合约仅 **`apiKey` + 可选 `appKey`**，无 `apiSecret` 第三字段。 |
| **成功标准** | ① 环境页可选讯飞极速版 provider，三件套凭证保存后 **credentials-only 探测** 为 available；② 5 min+ 中文 wav/mp3 手测返回 **≥2 语段** + `schema_version: 1`；③ 术语库经 `SttVocabularyPlan` → `business.dhw` 携带，超长有 `online_vocabulary_truncated_xunfei_speed_asr_hotword`；④ engine 标记 `iflytek:speed-transcription:file`；⑤ gates 通过（见 §10）。 |

---

## 2. 业内成熟路线（跨厂商，≥2）

| # | 路线 | 代表 | 核心机制 | 与 Rushi 关系 |
|---|------|------|----------|---------------|
| **A** | **继续仅百炼 Fun-ASR** | 阿里 DashScope `fun-asr` file Job | sk- Bearer → OSS 临时 URL → 异步 tasks 轮询 → `sentences[]` | **已实现**（`dashscope-asr`）；国内唯一在线 provider |
| **B** | **用户自建 custom-proxy 包讯飞** | 网关归一 Rushi `TranscriptionResult` JSON | 用户填 POST URL；壳发 multipart + 可选 `X-Rushi-Stt-App-Key` | **已实现**（`custom-proxy`）；零壳内维护，但用户需自建签名/轮询/解析 |
| **C** | **讯飞极速版原生 adapter**（本方案） | speedTranscription OST API | AppID+Key+Secret → HMAC 上传 → `pro_create`/`query` → `lattice` | **待建**；与百炼同深度集成 |
| **D** | **本机 FunASR / Sherpa ONNX** | Paraformer、Qwen3-ASR-VAD | 8741 侧车或进程内 ORT；无云 Key | **已实现**；隐私/离线优先，不替代「用户已有讯飞 Key」场景 |
| **E** | **其他国内云长音频**（腾讯/百度/华为等） | 各云 OpenAPI + 签名 | 异步 Job 或 URL 识别 | 2026-06 短窗口形态已移除；长音频可经 **B** 或后续薄片 |

**桌面剪辑向参考**（分段 UX，非 API 选型）：Descript / Otter 等依赖 **厂商句/词级时间戳 + 编辑器对齐**，与 Rushi Tier A 分段纪律一致（见 [`online-stt-segmentation-nlp-stack-research.md`](./online-stt-segmentation-nlp-stack-research.md)）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 仅百炼 | **高**（现状） | 全套 Provider 合约、环境 UI、术语 `DashScopeVocabulary` | 无讯飞 Key 用户无法选讯飞；方言/配额与讯飞控制台无关 | 已 E2E ✅ |
| B custom-proxy | **中** | bridge、multipart、归一 JSON 契约 | 用户负担签名与运维；无统一术语/探测 UX | 依赖用户网关 |
| **C 讯飞原生** | **高** | 见下表「本仓模块」；Job 轮询模式同百炼 | **三件套凭证** 需扩展合约；POST-only → credentials-only probe；音频格式较窄 | Rust 侧 reqwest 上传；峰值内存同读入 guard |
| D 本机 ASR | **高** | 长口述史默认路径 | 不上云；与「在线讯飞」用户群部分重叠 | GPU/模型缓存 |

**本仓已有可复用模块**（须扩展，禁止第二套 Job 栈）：

| 模块 | 路径 | 复用方式 |
|------|------|----------|
| 百炼文件 Job 编排 | `stt_native/dashscope_file_asr.rs`、`dashscope_upload.rs` | upload → submit → poll → parse 阶段划分 |
| Native 分发 | `stt_native/mod.rs` `dispatch_native` | 新增 `xunfeiSpeedAsr` 分支 |
| 在线 bridge | `online_stt_bridge.rs`、`bridge.ts` | 扩展 `api_secret` 字段 |
| 术语库 | `project/stt_vocabulary.rs`、`sttVocabularyBias.ts` | 新增 `XunfeiSpeedAsrHotword` channel |
| 分段归一 | `project/online_segment_normalize.rs` | `lattice` → segments 后 `refine_long_speech_segments` |
| 凭证分层 | `memorySecrets.ts`、`apiKeyStorage.ts`、AppData secret store | 扩展 `apiSecret` 会话内存 + 探测校验 |
| credentials-only 探测 | `presetEndpoints.ts` `sttOnlineProviderUsesCredentialsOnlyProbe`、`health.ts` | 讯飞 POST-only；扩展 `requiresApiSecret` + `requiresPersistedAppKey` |
| 转写 hints | `asrTranscribeHints.ts`、`projectStatusFeedbackCopy.ts` | engine / vocabulary truncation 文案 |

**Provider 命名（定稿）**：定义表 id **`iflytek-speed-asr`**（避免与已移除 `iflytek-speech`、标准 LFASR v2 混淆）；native adapter **`xunfeiSpeedAsr`**；下文「iflytek-lfasr / xunfeiLfasr」为历史草稿别名，Implement 以本名为准。

---

## 4. 结论摘要（给决策者）

| 问题 | 结论 |
|------|------|
| 默认接入哪个讯飞接口 | **讯飞极速录音转写大模型**（又名「录音文件转写极速版」，speedTranscription）。它是当前讯飞长音频转写中**最新、最快、方言覆盖最广**的 API：1 h 音频约 20 s 返回，支持中英 + 202 种方言免切。 |
| 为什么不选标准 LFASR v2 | 标准版成熟但慢（1 h 音频 10–20 min），方言需逐一手动授权；极速版在速度、免费额（个人 10 h/3 个月）、方言覆盖上全面更优。 |
| 凭证问题 | 极速版确实需要 `AppID + APIKey + APISecret` 三件套，**超出当前 UI 两字段**。通过 `requiresApiSecret` 标志扩展第三字段（`apiSecret` 内存 Secret）；provider id 定稿 **`iflytek-speed-asr`**。 |
| 签名机制 | HMAC-SHA256 `Authorization` header：`host`、`date`、`request-line`、`digest` 参与签名。 |
| 文件上传 | <30 MB 直接 `POST /file/upload`；≥30 MB 需分块上传（init → slices → complete），拿到 `audio_url` 后再创建任务。 |
| 异步轮询 | `POST /v2/ost/pro_create` 取 `task_id` → `POST /v2/ost/query` 轮询；`task_status == 3/4` 表示有结果。 |
| 术语库 / 热词 | `business.dhw`，多个热词用英文逗号 `,` 分隔，UTF-8。 |
| 免费额度 | 个人开发者 10 h/3 个月，企业开发者 30 h/3 个月；套餐 ¥198/40 h 起。 |

**若你坚持不扩展 UI 第三字段**，则回退到 **讯飞语音转写标准版 v2**（`raasr.xfyun.cn/v2/api`），它只需 `AppID + APIKey`，但速度和方言覆盖弱于极速版。

---

## 5. 讯飞三条长音频路线对比

### 5.1 路线 A：讯飞极速录音转写大模型 / 录音文件转写极速版（推荐）

| 维度 | 内容 |
|------|------|
| 产品页 | <https://www.xfyun.cn/services/fast_lfasr> |
| 官方文档 | <https://www.xfyun.cn/doc/asr/speedTranscription/API.html> |
| 上传 Base | `https://upload-ost-api.xfyun.cn` |
| 任务 Base | `https://ost-api.xfyun.cn/v2` |
| 核心接口 | 上传 `/file/upload`（小文件）或 `/file/mpupload/*`（分块）→ 取 `audio_url` → `POST /ost/pro_create` 取 `task_id` → `POST /ost/query` 轮询 |
| 限制 | ≤500 MB，≤5 h；建议 ≥5 min；结果保存 7 天 |
| 音频格式 | wav、pcm、mp3（文档示例；需以控制台为准） |
| 采样率/位长 | 16 kHz，16 bit，单声道 |
| 凭证 | `AppID` + `APIKey` + `APISecret` |
| 签名 | HMAC-SHA256：`signature_origin = host: $host\ndate: $date\n$request-line\ndigest: $digest`；`Authorization: api_key="...", algorithm="hmac-sha256", headers="host date request-line digest", signature="..."` |
| 热词 | 创建任务参数 `business.dhw`，英文逗号 `,` 分隔 |
| 说话人分离 | `business.vspp_on`、`business.speaker_num` |
| 语种 | `business.language: zh_cn`（中英 + 202 种方言免切） |
| 价格 / 免费 | 个人 10 h/3 个月；企业 30 h/3 个月；套餐 ¥198/40 h 起 |
| 结果格式 | `lattice` 数组：`json_1best.st.rt.ws.cw`，含 `bg`、`ed`、`w`、`wc`、`wp` |

### 5.2 路线 B：讯飞语音转写标准版 v2（LFASR v2 / ifasr_new）

| 维度 | 内容 |
|------|------|
| 官方文档 | <https://www.xfyun.cn/doc/asr/ifasr_new/API.html> |
| Base URL | `https://raasr.xfyun.cn/v2/api` |
| 核心接口 | `POST /upload` → 取 `orderId` → `GET /getResult` 轮询 |
| 限制 | ≤500 MB，≤5 h；建议 ≥5 min；结果保存 72 h |
| 音频格式 | mp3、wav、pcm、aac、opus、flac、ogg、m4a、amr、speex、lyb、ac3、ape、m4r、mp4、acc、wma |
| 采样率/位长 | 8/16 kHz，8/16 bit，单/多声道 |
| 凭证 | `AppID` + `APIKey` |
| 签名 | `signa = base64(HMAC-SHA1(lower(md5(appid + ts)), apiKey))`；`ts` 为 Unix 秒；URL 参数传递 |
| 热词 | 上传参数 `hotWord`，`\|` 分隔，≤200 条，单条 ≤16 字符 |
| 说话人分离 | `roleType`、`roleNum` |
| 语种 | 默认中英；其他方言/小语种需控制台购买授权 |
| 价格 / 免费 | 个人 5 h/年；企业 50 h/年；套餐 ¥198/80 h 起 |
| 结果格式 | `orderResult` JSON 数组字符串：`[{bg, ed, onebest, speaker, wordsResultList?}]` |

### 5.3 路线 C：录音文件转写大模型（spark asr_llm / Ifasr_llm）

| 维度 | 内容 |
|------|------|
| 官方文档 | <https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html> |
| Base URL | `https://office-api-ist-dx.iflyaisol.com` |
| 核心接口 | `POST /v2/upload` → 取 `orderId` → `POST /v2/getResult` 轮询 |
| 限制 | ≤500 MB，≤5 h；结果保存 7 天 |
| 音频格式 | mp3、wav、pcm、mp4、m4a、aac、opus、flac、ogg、amr、speex、lyb、ac3、ape、m4r、wma 等 |
| 采样率/位长 | 8/16 kHz，16 bit，单声道 |
| 凭证 | `AppID` + `AccessKeyId` + `APISecret` |
| 签名 | HMAC-SHA1，基于 `host`、`date`、`request-line`；`Authorization` header |
| 热词 | 当前公开文档未明确 session 热词参数 |
| 语种 | `autodialect`（中英 + 202 方言）、`autominor`（37 语种） |
| 价格 / 免费 | 需商务/控制台确认；文档未列公开套餐价 |
| 结果格式 | `lattice` / `lattice2` 递归词结构 |

### 5.4 为什么不选路线 C

路线 C 与路线 A 都支持 202 方言，但路线 A（极速版）有公开套餐价、更完整的热词参数、更成熟的 Skill/demo 生态，且个人免费额度更友好。路线 C 更适合需要 37 个小语种（非方言）的场景，作为远期 spike 预留。

---

## 6. 与 Rushi 现状的对照

| 维度 | 百炼 Fun-ASR（目标对标） | 讯飞极速版（本方案） |
|------|--------------------------|----------------------|
| Provider 定义 | `dashscope-asr` 行 | 新增 **`iflytek-speed-asr`** 行 |
| Native adapter | `dashscopeAsr` | 新增 **`xunfeiSpeedAsr`** |
| Engine 标记 | `dashscope:fun-asr:file` | **`iflytek:speed-transcription:file`** |
| 凭证 | `apiKey` 单 Bearer | `appKey` → AppID；`apiKey` → APIKey；**`apiSecret`** → APISecret |
| 文件上传 | 临时 OSS URL | 直接上传 / 分块上传（P2） |
| 异步 Job | `tasks/{id}` 轮询 | `pro_create` + `query` 轮询 |
| 热词/术语库 | `speech-biasing` vocabulary_id | `business.dhw` 请求参数 |
| 健康探测 | GET `/compatible-mode/v1/models` | **credentials-only**（AppID + APIKey + APISecret 齐全 → `available`） |
| 结果归一化 | `sentences[]` + `words[]` | `lattice[].json_1best.st.rt.ws` |
| 与已移除 provider | — | **`iflytek-speech`**（短听写）已迁百炼；新 id **不得**复用 |

### 6.1 健康探测（credentials-only）

讯飞 OST 端点仅接受 POST，Implement 复用 [`sttOnlineProviderUsesCredentialsOnlyProbe`](../../../apps/desktop/src/services/stt/sttOnlineProviderContract/presetEndpoints.ts) 模式：

1. `definitions.ts`：`requiresPersistedAppKey: true`（AppID）、**`requiresApiSecret: true`**
2. `health.ts`：三字段齐全 → `state: available`；缺任一项 → `unconfigured` + 字段级文案
3. **不** 发空任务 / 假上传做网络 probe（避免误耗配额）；首次转写失败时映射厂商 HTTP 码为用户可读错误

---

## 7. 决策：不做什么

| 项 | 说明 |
|----|------|
| 标准 LFASR v2 并行 provider | Grill 2026-06-18：已接受三件套 → **仅极速版** |
| spark `asr_llm` / Ifasr_llm（路线 C） | 37 小语种场景远期预留 |
| 说话人分离 | `vspp_on=0`、`speaker_num=0` 固定；不做 diarization UI |
| 202 方言全量 UI | 仅 **8 项 Xunfei accent preset**（见 plan §1.2） |
| 非 `zh_cn` language 选择器 | `language` 固定 `zh_cn` |
| 在线失败回落本机 ASR | **仅报错**；禁止静默或弹窗 fallback |
| WebSocket 短听写 | 不恢复已移除的 `iflytek-speech` |
| 第二套 Job / vocabulary 栈 | 必须复用 `dispatch_native`、`SttVocabularyPlan`、`online_segment_normalize` |
| 用本机 `/health.ready_for_transcribe` 表示讯飞就绪 | 见 acceptance 能力—UI 矩阵 |

**Grill 2026-06-18 纳入 P1（原「不做」已撤销）**：

| 项 | 说明 |
|----|------|
| ≥30 MB 分块上传 | **P1 必做**（`mpupload/*`） |
| 壳内 ffmpeg 归一 | 非 wav/mp3/pcm → 16 kHz mono wav（bundled ffmpeg，对齐侧车纪律） |

**与 ADR / architecture**：遵循 [`stt-online-providers.md`](../../architecture/stt-online-providers.md) 壳内直连 + 密钥分层；术语真源 [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)；分段 Tier A 优先（[`online-stt-segment-unify-plan.md`](./online-stt-segment-unify-plan.md)）。

---

## 8. 实现落位预告

### 8.1 前端（TypeScript）

| 文件 | 变更 |
|------|------|
| `apps/desktop/src/services/stt/sttOnlineProviderContract/types.ts` | `SttOnlineProviderDefinition` 增加 `requiresApiSecret?: boolean`；`OnlineNativeAdapterId` 增加 `"xunfeiSpeedAsr"`；`OnlineTranscribeBridgePayload` 增加 `apiSecret?`。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/definitions.ts` | 新增 **`iflytek-speed-asr`** 行；`requiresPersistedAppKey` + `requiresApiSecret`。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/nativeAdapters.ts` | `case "iflytek-speed-asr": return "xunfeiSpeedAsr"`。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/presetEndpoints.ts` | 预置 OST 任务端点展示；纳入 `sttOnlineProviderUsesCredentialsOnlyProbe`。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/constants.ts` | 预置 URL 常量（upload + ost base）。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/memorySecrets.ts` | 内存中增加 `apiSecret`，与 `apiKey` 同生命周期。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/health.ts` | `requiresApiSecret` 探测分支。 |
| `apps/desktop/src/services/stt/sttOnlineProviderContract/bridge.ts` | `tryBuildOnlineTranscribeBridgePayload` 透传 `apiSecret`。 |
| `apps/desktop/src/components/envOnlineStt/OnlineSttRuntimeForm.tsx` | `requiresApiSecret` 时显示第三输入框。 |
| `apps/desktop/src/services/stt/sttVocabularyBias.ts` | channel + preflight 文案 |
| `apps/desktop/src/services/asrTranscribeHints.ts` | truncation hint 分型 |

> **凭证 UI 映射**：`appKey` → AppID；`apiKey` → APIKey；`apiSecret` → APISecret。AppID 可持久化；APIKey/APISecret 仅内存/AppData 受保护存储；profile 导出 **剥离** secret。

### 8.2 Rust（Tauri）

为遵守 `.rs > 500 行 → 拆模块` 与 `check-architecture-guard.mjs` 增量约束，将 adapter 拆为子模块：

| 文件 | 职责 |
|------|------|
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/mod.rs` | 入口 `transcribe_xunfei_speed_asr`、凭证校验、engine=`iflytek:speed-transcription:file`。 |
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/auth.rs` | 生成 HMAC-SHA256 `Authorization` header 与 `digest`。 |
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/upload.rs` | 小文件直接上传；大文件分块上传（P2）；返回 `audio_url`。 |
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/task.rs` | `pro_create` 创建任务、取 `task_id`。 |
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/poll.rs` | `query` 轮询、取消检查、超时处理。 |
| `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/parse.rs` | 解析 `lattice[].json_1best.st.rt.ws` → segments / full_text / timed_words。 |
| `apps/desktop/src-tauri/src/stt_native/mod.rs` | `pub mod xunfei_speed_asr;`，`dispatch_native` 增加 `"xunfeiSpeedAsr"` 分支。 |
| `apps/desktop/src-tauri/src/online_stt_bridge.rs` | `OnlineTranscribeBridge` 增加 `api_secret` 字段。 |
| `apps/desktop/src-tauri/src/project/run_transcribe_cmd/online_fetch.rs` | `match` 增加 `"xunfeiSpeedAsr"` 分支。 |
| `apps/desktop/src-tauri/src/project/stt_vocabulary.rs` | 新增 `SttVocabularyChannel::XunfeiSpeedAsrHotword`；逗号连接与截断/警告。 |

### 8.3 签名细节（必须写对）

```text
1. date = RFC1123 GMT，例如 "Wed, 05 Jan 2022 09:29:14 GMT"
2. digest = "SHA-256=" + base64(sha256(request_body))
3. signature_origin =
   host: $host
   date: $date
   POST $path HTTP/1.1
   digest: $digest
4. signature = base64(HMAC-SHA256(signature_origin, apiSecret))
5. Authorization =
   api_key="$apiKey", algorithm="hmac-sha256", headers="host date request-line digest", signature="$signature"
```

- 所有请求头必须包含 `host`、`date`、`digest`、`authorization`。
- 服务端时钟偏移校验：最大允许 300 s。

### 8.4 上传与任务流程

**小文件（<30 MB）**：

```text
POST https://upload-ost-api.xfyun.cn/file/upload
Headers: host, date, digest, authorization
Body: multipart/form-data
  - app_id: AppID
  - request_id: UUID
  - data: 音频文件
```

返回 `data.url`。

**大文件（≥30 MB）**：

```text
POST /file/mpupload/init  → upload_id
POST /file/mpupload/upload  → 逐片上传（slice_id）
POST /file/mpupload/complete  → data.url
```

**创建任务**：

```text
POST https://ost-api.xfyun.cn/v2/ost/pro_create
Body:
{
  "common": { "appid": "..." },
  "business": {
    "request_id": "...",
    "language": "zh_cn",
    "domain": "pro_ost_ed",
    "accent": "mandarin",
    "dhw": "热词1,热词2,...",
    "vspp_on": 0,
    "speaker_num": 0
  },
  "data": {
    "audio_url": "...",
    "audio_src": "http",
    "audio_size": 3136940,
    "format": "audio/L16;rate=16000",
    "encoding": "raw" / "lame"
  }
}
```

返回 `data.task_id`。

**轮询结果**：

```text
POST https://ost-api.xfyun.cn/v2/ost/query
Body: { "common": { "appid": "..." }, "business": { "task_id": "..." } }
```

`task_status`: 1 待处理 / 2 处理中 / 3 处理完成 / 4 回调完成。

### 8.5 结果解析

极速版返回 `data.result.lattice[]`，结构示例：

```json
{
  "bg": "0",
  "ed": "4950",
  "json_1best": {
    "st": {
      "bg": "0",
      "ed": "4950",
      "rt": [{
        "ws": [{
          "cw": [{ "w": "科", "wc": "1.0", "wp": "n" }],
          "wb": "0", "we": "20"
        }]
      }]
    }
  }
}
```

解析到 Rushi segment：`start_sec = bg/1000.0`，`end_sec = ed/1000.0`，`text` 由 `cw[].w` 拼接（按 `wp` 处理标点）。复用 `online_segment_normalize::refine_long_speech_segments`。

### 8.6 术语库映射

| Rushi `SttVocabularyPlan` | 讯飞极速版 |
|---------------------------|------------|
| `terms`（空格分隔） | 用英文逗号 `,` 连接为 `business.dhw` |
| 上限 | **spike 待验证**（极速版文档未明确）；Implement 先按 200 条、单条 ≤16 字符截断，与标准 v2 对齐并写单测 |
| 失败策略 | 超长/超数量时截断并追加 warning **`online_vocabulary_truncated_xunfei_speed_asr_hotword`** |

---

## 9. 风险与 spike 项

| # | 风险 | 缓解 |
|---|------|------|
| 1 | **UI 需扩展第三凭证字段**，影响 Provider 合约、secret store、运行时配置、表单 | 仅在 **`iflytek-speed-asr`** 生效；`requiresApiSecret` 可选字段，向后兼容。 |
| 2 | 分块上传实现复杂（init/slice/complete） | <30 MB 直接上传覆盖大多数口述史文件；≥30 MB 再实现分块。 |
| 3 | HMAC-SHA256 `Authorization` header 构造错误导致 401 | 单元测试覆盖签名生成，与官方示例对齐。 |
| 4 | `digest` 计算与 multipart boundary 处理 | 使用 `reqwest` 构造 multipart，计算 body bytes 的 SHA-256。 |
| 5 | 大文件上传触发前端 600 s timeout | Rust adapter 内部管理 deadline；HTTP client 设置合理连接/发送超时。 |
| 6 | `lattice` 解析缺失或格式变化 | 健壮解析，失败时回退到整段文本并追加 warning。 |
| 7 | 方言/多语种授权 | 默认 `zh_cn`；其他 language 作为远期增强。 |
| 8 | 热词条数/长度上限未在极速版文档明确 | P1 按 v2 保守截断 + warning；手测后校正或标 spike |

---

## 10. 验收参考

- 完整 checklist：[`acc-stt-iflytek-acceptance.md`](./acc-stt-iflytek-acceptance.md)、[`acc-stt-iflytek-hand-test-checklist.md`](./acc-stt-iflytek-hand-test-checklist.md)
- `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过。
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` 通过。
- Rust 新增模块文件 ≤500 行；TS 新增/修改文件 ≤300 行或仅 warning。
- 单元测试：
  - `xunfei_speed_asr::auth`：HMAC-SHA256 签名与官方示例一致。
  - `xunfei_speed_asr::parse`：mock `lattice` → segments / full_text / timed_words。
  - `stt_vocabulary`：`XunfeiSpeedAsrHotword` 逗号连接与截断正确。
- 手测：环境面板选择「讯飞极速录音转写」→ 填入 AppID / APIKey / APISecret → 保存并探测 → 主舞台选择在线转写 → 上传 5 min 以上中文 wav/mp3 → 成功返回分段结果。

---

## 11. 签收

- [x] 调研 brief 完成（含 §1–§3 门禁章节）
- [x] plan / acceptance / hand-test 已链接本文
- [x] Grill 2026-06-18 产品分叉已对齐（见 plan §0）
- [x] P0/P1 代码落地（2026-06-18）
- [ ] 手测 checklist 全绿

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-16 | 初版：选定讯飞 LFASR v2 标准版 |
| 2026-06-16 | 更新：改推荐讯飞极速录音转写大模型，补充三件套凭证与 UI 扩展方案 |
| 2026-06-18 | 补全门禁：§1–§3、§7、probe/命名；链 acc-stt-iflytek plan/acceptance |
| 2026-06-18 | Grill：分块+ffmpeg 入 P1；accent 8 项 preset；失败仅报错 |
