import {
  getSttOnlineProviderDefinition,
  sttOnlineProviderEndpointUserConfigurable,
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
  hasApiKeyReference: boolean;
  hasTypedApiKey: boolean;
  keychainReady: boolean | null;
  connectionVerified: boolean;
  lastProbeAvailable: boolean | null;
  lastProbeMessage: string | null;
};

function configComplete(input: BuildOnlineSttEnvPresentationInput): boolean {
  const def = getSttOnlineProviderDefinition(input.providerId);
  const endpointMissing =
    sttOnlineProviderEndpointUserConfigurable(input.providerId) && !input.endpoint.trim();
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
      bannerDetail: "未启用时仍走本机 ASR。",
      chipOk: false,
    };
  }

  const def = getSttOnlineProviderDefinition(input.providerId);
  const endpointMissing =
    sttOnlineProviderEndpointUserConfigurable(input.providerId) && !input.endpoint.trim();
  const appKeyMissing = def?.requiresPersistedAppKey && !input.appKey.trim();

  if (endpointMissing || appKeyMissing) {
    const parts: string[] = [];
    if (endpointMissing) parts.push("转写 URL");
    if (appKeyMissing) parts.push(def?.persistedAppKeyFieldLabel ?? "应用标识");
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 配置不完整",
      bannerDetail: `请填写${parts.join("与")}并保存。`,
      chipOk: false,
    };
  }

  const hasKey = input.hasTypedApiKey || input.hasApiKeyReference;
  const keyMaterialReady = input.hasTypedApiKey || input.keychainReady === true;
  const ready =
    configComplete(input) && hasKey && keyMaterialReady && input.connectionVerified;

  if (input.keychainReady === null && !input.hasTypedApiKey && hasKey) {
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 校验密钥",
      bannerDetail: "正在确认本地密钥…",
      chipOk: false,
    };
  }

  if (input.keychainReady === false && !input.hasTypedApiKey && hasKey) {
    return {
      tone: "error",
      bannerTitle: "在线 STT · 密钥异常",
      bannerDetail: "本地密钥丢失，请重新保存。",
      chipOk: false,
    };
  }

  if (ready) {
    return {
      tone: "ok",
      bannerTitle: "在线 STT · 服务就绪",
      bannerDetail: input.lastProbeMessage?.trim() || "已验证，可转写。",
      chipOk: true,
    };
  }

  if (!hasKey) {
    if (input.connectionVerified) {
      return {
        tone: "warn",
        bannerTitle: "在线 STT · 待填写凭证",
        bannerDetail: "请填写 API Key 并保存。",
        chipOk: false,
      };
    }
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "请填写 Key 并探测。",
      chipOk: false,
    };
  }

  if (input.lastProbeAvailable === false) {
    return {
      tone: "error",
      bannerTitle: "在线 STT · 连接未通过",
      bannerDetail: input.lastProbeMessage?.trim() || "请检查密钥与网络后重试。",
      chipOk: false,
    };
  }

  if (!input.connectionVerified) {
    return {
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "请探测连接。",
      chipOk: false,
    };
  }

  return {
    tone: "warn",
    bannerTitle: "在线 STT · 已启用",
    bannerDetail: "请保存并探测。",
    chipOk: false,
  };
}
