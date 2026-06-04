import {
  getSttOnlineProviderDefinition,
  sttOnlineProviderAllowsEmptyEndpoint,
} from "./sttOnlineProviderContract";

export type OnlineSttEnvTone = "ok" | "warn" | "error" | "idle";

export type OnlineSttEnvPresentation = {
  tone: OnlineSttEnvTone;
  bannerTitle: string;
  bannerDetail: string;
  chipOk: boolean;
};

export type BuildOnlineSttEnvPresentationInput = {
  enabled: boolean;
  providerId: string;
  endpoint: string;
  appKey: string;
  hasApiKeyInSession: boolean;
  /** 持久化指纹与当前配置一致（曾探测成功） */
  connectionVerified: boolean;
  /** null = 尚未探测；true/false = 最近一次探测结果 */
  lastProbeAvailable: boolean | null;
  lastProbeMessage: string | null;
};

function endpointRequired(providerId: string): boolean {
  return !sttOnlineProviderAllowsEmptyEndpoint(providerId);
}

function configComplete(input: BuildOnlineSttEnvPresentationInput): boolean {
  const def = getSttOnlineProviderDefinition(input.providerId);
  const endpointMissing = endpointRequired(input.providerId) && !input.endpoint.trim();
  const appKeyMissing = def?.requiresPersistedAppKey && !input.appKey.trim();
  return !endpointMissing && !appKeyMissing;
}

export function buildOnlineSttEnvPresentation(
  input: BuildOnlineSttEnvPresentationInput,
): OnlineSttEnvPresentation {
  if (!input.enabled) {
    return {
      tone: "idle",
      bannerTitle: "在线 STT · 未启用",
      bannerDetail: "关闭时转写仍走本机 ASR；开启后可选用云端或自建 HTTPS 网关。",
      chipOk: false,
    };
  }

  const def = getSttOnlineProviderDefinition(input.providerId);
  const endpointMissing = endpointRequired(input.providerId) && !input.endpoint.trim();
  const appKeyMissing = def?.requiresPersistedAppKey && !input.appKey.trim();

  if (endpointMissing || appKeyMissing) {
    const parts: string[] = [];
    if (endpointMissing) parts.push("转写 URL");
    if (appKeyMissing) parts.push(def?.persistedAppKeyFieldLabel ?? "应用标识");
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 配置不完整",
      bannerDetail: `请填写${parts.join("与")}并保存；根凭证仅保留在当前页面会话内存。`,
      chipOk: false,
    };
  }

  const ready =
    configComplete(input) && input.hasApiKeyInSession && input.connectionVerified;

  if (ready) {
    return {
      tone: "ok",
      bannerTitle: "在线 STT · 服务就绪",
      bannerDetail:
        input.lastProbeMessage?.trim() ||
        "配置已验证；转写时将按所选厂商映射全局术语表（若支持）。",
      chipOk: true,
    };
  }

  if (!input.hasApiKeyInSession) {
    if (input.connectionVerified) {
      return {
        tone: "warn",
        bannerTitle: "在线 STT · 待填写凭证",
        bannerDetail: "此前探测已通过；请填写根凭证（仅内存，不落盘）后即可转写。",
        chipOk: false,
      };
    }
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "请填写根凭证（仅内存，不落盘）后点击「探测连接」确认可达。",
      chipOk: false,
    };
  }

  if (input.lastProbeAvailable === false) {
    return {
      tone: "error",
      bannerTitle: "在线 STT · 连接未通过",
      bannerDetail:
        input.lastProbeMessage?.trim() ||
        "请检查 HTTPS URL、密钥与网络后重试探测。",
      chipOk: false,
    };
  }

  if (!input.connectionVerified) {
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "应用标识与 URL 已保存；请点击「探测连接」验证密钥与网络。",
      chipOk: false,
    };
  }

  return {
    tone: "warn",
    bannerTitle: "在线 STT · 已启用",
    bannerDetail: "请保存配置并探测连接。",
    chipOk: false,
  };
}
