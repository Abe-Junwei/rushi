import type { SttOnlineMarket, SttOnlineProviderDefinition } from "./types";

/** 市面常见在线 STT；仅保留适合口述史长音频或异步 Job 的形态（短窗口 REST/WS 已移除）。 */
export const STT_ONLINE_PROVIDER_DEFINITIONS: SttOnlineProviderDefinition[] = [
  {
    id: "dashscope-asr",
    label: "阿里云百炼语音识别（Fun-ASR）",
    description:
      "百炼 Fun-ASR 录音文件异步转写（临时 OSS + Job）；术语库可同步热词表（target_model=fun-asr）。",
    docsUrl: "https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: true,
      segmentTimestamps: true,
      wordTimestamps: true,
    },
    experimental: false,
    market: "china",
    credentialHint: "百炼 sk- Key，可与 LLM 百炼共用。",
    credentialPlaceholder: "sk-…",
    freeTierNote: "开通后 90 天内 10 小时免费额（以控制台为准）",
    billingNote:
      "按模型判定的语音时长（秒）计费，静音通常不计、识别结果不计费；中国内地 fun-asr 约 0.00022 元/秒。",
  },
  {
    id: "iflytek-speed-asr",
    label: "讯飞极速录音转写大模型",
    description:
      "讯飞开放平台「录音文件转写极速版」（speedTranscription）长音频异步转写；区别于标准 LFASR 慢版与实时听写。适合 5 分钟以上口述史，支持口音/方言选择与术语热词。",
    docsUrl: "https://www.xfyun.cn/doc/asr/speedTranscription/API.html",
    authStyle: "header",
    headerName: "authorization",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: false,
      asyncJob: true,
      segmentTimestamps: true,
      wordTimestamps: true,
    },
    experimental: false,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "AppID",
    requiresApiSecret: true,
    credentialFieldLabel: "APIKey",
    credentialHint: "保存后写入本机密钥存储。",
    credentialPlaceholder: "控制台 APIKey",
    freeTierNote: "个人开发者常见 10 小时/3 个月免费额（以控制台为准）",
    billingNote: "按音频时长计费；套餐与免费额以讯飞控制台为准。",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "在线转写默认 whisper-1（词级/句级时间戳）；Bearer Token。",
    docsUrl: "https://platform.openai.com/docs/guides/speech-to-text",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
      wordTimestamps: true,
    },
    experimental: false,
    market: "global",
    credentialHint: "OpenAI API Key（sk-…）。",
    credentialPlaceholder: "sk-…",
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
      wordTimestamps: true,
    },
    experimental: false,
    market: "global",
    credentialHint: "AssemblyAI API Key。",
    credentialPlaceholder: "aa-…",
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
      wordTimestamps: true,
    },
    experimental: false,
    market: "global",
    credentialHint: "Deepgram API Key 或 Token。",
    credentialPlaceholder: "Token 或 API Key",
    freeTierNote: "（新账户常见有免费试用额，以控制台为准）",
  },
  {
    id: "custom-proxy",
    label: "自定义代理（Rushi 契约）",
    description: "自建 HTTPS 网关，归一为 Rushi JSON 契约。",
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
    credentialHint: "自建网关 POST URL + Bearer Token。",
    credentialPlaceholder: "代理 Token 或 API Key",
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

/** 环境页厂商 chip 单行列表（定义表顺序，不分国内/国际）。 */
export function sttOnlineProviderPickerOptions(): SttOnlineProviderDefinition[] {
  return [...STT_ONLINE_PROVIDER_DEFINITIONS];
}
