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
  chipLabel: string;
  chipTitle: string;
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

function vendorShortLabel(providerId: string): string {
  return getSttOnlineProviderDefinition(providerId)?.label ?? "在线 STT";
}

function chipLabelFor(input: {
  enabled: boolean;
  tone: OnlineSttEnvTone;
  providerId: string;
  connectionVerified: boolean;
}): string {
  if (!input.enabled || input.tone === "idle") return "在线 STT 未启用";
  if (input.tone === "ok") return vendorShortLabel(input.providerId);
  if (input.tone === "error") return "在线 STT 异常";
  if (!input.connectionVerified) return "在线 STT 待验证";
  return "在线 STT 待配置";
}

function chipTitleFor(presentation: Pick<OnlineSttEnvPresentation, "bannerTitle" | "bannerDetail">): string {
  return `${presentation.bannerTitle} · ${presentation.bannerDetail}`;
}

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
    const idle = {
      tone: "idle" as const,
      bannerTitle: "在线 STT · 未启用",
      bannerDetail: "未启用时仍走本机 ASR。",
      chipOk: false,
    };
    return {
      ...idle,
      chipLabel: chipLabelFor({ ...idle, enabled: false, providerId: input.providerId, connectionVerified: false }),
      chipTitle: chipTitleFor(idle),
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
    const incomplete = {
      tone: "warn" as const,
      bannerTitle: "在线 STT · 配置不完整",
      bannerDetail: `请填写${parts.join("与")}并保存。`,
      chipOk: false,
    };
    return {
      ...incomplete,
      chipLabel: chipLabelFor({
        enabled: true,
        tone: incomplete.tone,
        providerId: input.providerId,
        connectionVerified: input.connectionVerified,
      }),
      chipTitle: chipTitleFor(incomplete),
    };
  }

  const hasKey = input.hasTypedApiKey || input.hasApiKeyReference;
  const keyMaterialReady = input.hasTypedApiKey || input.keychainReady === true;
  const ready =
    configComplete(input) && hasKey && keyMaterialReady && input.connectionVerified;

  const withChip = (
    body: Omit<OnlineSttEnvPresentation, "chipLabel" | "chipTitle">,
  ): OnlineSttEnvPresentation => ({
    ...body,
    chipLabel: chipLabelFor({
      enabled: true,
      tone: body.tone,
      providerId: input.providerId,
      connectionVerified: input.connectionVerified,
    }),
    chipTitle: chipTitleFor(body),
  });

  if (input.keychainReady === null && !input.hasTypedApiKey && hasKey) {
    return withChip({
      tone: "warn",
      bannerTitle: "在线 STT · 校验密钥",
      bannerDetail: "正在确认本地密钥…",
      chipOk: false,
    });
  }

  if (input.keychainReady === false && !input.hasTypedApiKey && hasKey) {
    return withChip({
      tone: "error",
      bannerTitle: "在线 STT · 密钥异常",
      bannerDetail: "本地密钥丢失，请重新保存。",
      chipOk: false,
    });
  }

  if (ready) {
    return withChip({
      tone: "ok",
      bannerTitle: "在线 STT · 服务就绪",
      bannerDetail: input.lastProbeMessage?.trim() || "已验证，可转写。",
      chipOk: true,
    });
  }

  if (!hasKey) {
    if (input.connectionVerified) {
      return withChip({
        tone: "warn",
        bannerTitle: "在线 STT · 待填写凭证",
        bannerDetail: "请填写 API Key 并保存。",
        chipOk: false,
      });
    }
    return withChip({
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "请填写 Key 并探测。",
      chipOk: false,
    });
  }

  if (input.lastProbeAvailable === false) {
    return withChip({
      tone: "error",
      bannerTitle: "在线 STT · 连接未通过",
      bannerDetail: input.lastProbeMessage?.trim() || "请检查密钥与网络后重试。",
      chipOk: false,
    });
  }

  if (!input.connectionVerified) {
    return withChip({
      tone: "warn",
      bannerTitle: "在线 STT · 待验证",
      bannerDetail: "请探测连接。",
      chipOk: false,
    });
  }

  return withChip({
    tone: "warn",
    bannerTitle: "在线 STT · 已启用",
    bannerDetail: "请保存并探测。",
    chipOk: false,
  });
}
