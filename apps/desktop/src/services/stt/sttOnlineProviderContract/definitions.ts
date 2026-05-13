import type { SttOnlineMarket, SttOnlineProviderDefinition } from "./types";

/** 市面常见在线 STT + 国内主流云厂商（能力为典型形态，以各厂商文档为准；部分由桌面壳 `stt_native` 直连，其余可走自建网关归一为 Rushi JSON）。 */
export const STT_ONLINE_PROVIDER_DEFINITIONS: SttOnlineProviderDefinition[] = [
  {
    id: "aliyun-nls",
    label: "阿里云智能语音交互（NLS）",
    description:
      "一句话识别 REST（nls-gateway 区域域名）；AppKey 持久化，Token（X-NLS-Token）放内存。长音频建议录音文件识别或自建代理。",
    docsUrl: "https://help.aliyun.com/zh/isi/developer-reference/restful-api-2",
    authStyle: "header",
    headerName: "X-NLS-Token",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: true, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "NLS AppKey（可持久化）",
    defaultEndpointExample: "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr",
    freeTierNote: "（新用户多含试用/免费额，以控制台为准）",
  },
  {
    id: "tencent-asr",
    label: "腾讯云语音识别",
    description:
      "API 3.0 SentenceRecognition（asr.tencentcloudapi.com）；桌面壳内 TC3-HMAC-SHA256 直连。SecretId 可持久化，SecretKey 仅内存。",
    docsUrl: "https://cloud.tencent.com/document/product/1093/35646",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "SecretId（可持久化）",
    defaultEndpointExample: "https://asr.tencentcloudapi.com/",
    freeTierNote: "（新用户多含试用/免费额，以控制台为准）",
  },
  {
    id: "baidu-speech",
    label: "百度语音技术（开放平台）",
    description:
      "短语音识别标准版（vop.baidu.com/server_api）；桌面壳内 OAuth + 识别。API Key 可持久化，Secret Key 仅内存。",
    docsUrl: "https://ai.baidu.com/tech/speech/asr",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: false, asyncJob: false, segmentTimestamps: false },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "API Key（可持久化，对应 client_id）",
    defaultEndpointExample: "https://vop.baidu.com/server_api",
    freeTierNote: "（开放平台常见有免费调用额，以控制台为准）",
  },
  {
    id: "iflytek-speech",
    label: "科大讯飞语音识别",
    description:
      "语音听写 WebAPI v2（iat-api.xfyun.cn）；壳内 WebSocket + HMAC 鉴权。AppId 持久化；内存填 `APIKey|APISecret`（控制台 WebAPI 密钥）。当前壳实现仅支持 WAV/PCM 16k 单声道。",
    docsUrl: "https://www.xfyun.cn/doc/asr/voicedictation/API.html",
    authStyle: "header",
    headerName: "Authorization",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "讯飞 AppId（可持久化）",
    freeTierNote: "（新应用常见有试用/免费额，以控制台为准）",
  },
  {
    id: "huawei-sis",
    label: "华为云语音交互服务（SIS）",
    description:
      "RecognizeShortAudio；壳内 SDK-HMAC-SHA256。ProjectId 持久化；内存 `AccessKeyId|SecretAccessKey`；endpoint 可填区域 HTTPS 基址（示例 cn-north-4）。",
    docsUrl: "https://support.huaweicloud.com/api-sisapi/sis_03_0021.html",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "ProjectId（可持久化）",
    defaultEndpointExample: "https://sis-ext.cn-north-4.myhuaweicloud.com",
    freeTierNote: "（新账号多含试用/免费额，以控制台为准）",
  },
  {
    id: "volcengine-speech",
    label: "火山引擎（字节）语音识别",
    description:
      "豆包大模型 ASR v3（bigmodel_nostream WebSocket）；壳内二进制帧。AppId 持久化；内存填控制台 Access Token；可选 endpoint 填 Resource-Id（默认 volc.bigasr.sauc.duration）。",
    docsUrl: "https://www.volcengine.com/docs/6561/79817",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "X-Api-App-Key（AppId，可持久化）",
    freeTierNote: "（新用户多含试用/赠额，以控制台为准）",
  },
  {
    id: "aispeech",
    label: "思必驰（AISpeech）",
    description:
      "DUI 一句话 LASR v2（lasr.duiopen.com）；壳内 multipart。ProductId 持久化；内存填云对云 apiKey。",
    docsUrl: "https://cloud.aispeech.com/docs/ct_asr_sentence",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "ProductId（可持久化）",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Whisper / gpt-4o-mini-transcribe 等音频转写 REST，Bearer Token。",
    docsUrl: "https://platform.openai.com/docs/guides/speech-to-text",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（新账户或活动期或有试用额，以平台账单为准）",
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    description: "异步转写 Job + 轮询/Webhook；流式 Universal-Streaming。",
    docsUrl: "https://www.assemblyai.com/docs",
    authStyle: "header",
    headerName: "authorization",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: true,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（开发者常见有免费试用额，以控制台为准）",
  },
  {
    id: "deepgram",
    label: "Deepgram",
    description: "Nova 等模型；流式与 REST 预录转写，Token / Bearer。",
    docsUrl: "https://developers.deepgram.com/docs",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（新账户常见有免费试用额，以控制台为准）",
  },
  {
    id: "google-cloud-stt",
    label: "Google Cloud Speech-to-Text",
    description: "Chirp 等；服务账号 OAuth2，批量与流式 gRPC/REST。",
    docsUrl: "https://cloud.google.com/speech-to-text/docs",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: true,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
    freeTierNote: "（GCP 新用户常见含试用额，以结算为准）",
  },
  {
    id: "azure-speech",
    label: "Microsoft Azure Speech",
    description: "区域终结点 + Key 或 Token；实时与批量。",
    docsUrl: "https://learn.microsoft.com/azure/ai-services/speech-service/",
    authStyle: "header",
    headerName: "Ocp-Apim-Subscription-Key",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
    freeTierNote: "（Azure 新订阅常见含试用额，以门户为准）",
  },
  {
    id: "custom-proxy",
    label: "自定义代理（Rushi 契约）",
    description:
      "自建 HTTPS 网关，将各厂商响应归一为 Rushi `TranscriptionResult` schema_version 1；与本机 rushi_asr 并存。",
    docsUrl: "https://example.com",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: false,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
  },
];

/** 下拉框等处的展示文案：名称 + 实验标记 + 免费额备注（若有）。 */
export function formatSttOnlineProviderSelectLabel(d: SttOnlineProviderDefinition): string {
  let s = d.label;
  if (d.experimental) s += "（实验）";
  if (d.freeTierNote) s += ` ${d.freeTierNote}`;
  return s;
}

export function sttOnlineProvidersByMarket(market: SttOnlineMarket): SttOnlineProviderDefinition[] {
  const list = STT_ONLINE_PROVIDER_DEFINITIONS.filter((d) => d.market === market);
  const withIndex = list.map((d, definitionOrder) => ({
    d,
    definitionOrder,
    freeFirst: d.freeTierNote ? 1 : 0,
  }));
  withIndex.sort((a, b) => {
    if (b.freeFirst !== a.freeFirst) return b.freeFirst - a.freeFirst;
    return a.definitionOrder - b.definitionOrder;
  });
  return withIndex.map((x) => x.d);
}

export function getSttOnlineProviderDefinition(id: string): SttOnlineProviderDefinition | undefined {
  return STT_ONLINE_PROVIDER_DEFINITIONS.find((d) => d.id === id);
}
