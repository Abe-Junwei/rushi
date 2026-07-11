import { getSttOnlineProviderDefinition } from "./sttOnlineProviderContract/definitions";

/**
 * Short vendor label for busy overlays / compact status copy.
 * Env chips keep the full catalog `def.label` for ok state; do not reuse this there.
 */
const SHORT_LABEL_BY_PROVIDER_ID: Record<string, string> = {
  "dashscope-asr": "百炼",
  "iflytek-speed-asr": "讯飞极速大模型",
};

export function onlineTranscribeProviderShortLabel(providerId: string): string {
  const mapped = SHORT_LABEL_BY_PROVIDER_ID[providerId];
  if (mapped) return mapped;
  const def = getSttOnlineProviderDefinition(providerId);
  if (!def) return "云端";
  const short = def.label.split("（")[0]?.split("(")[0]?.trim();
  return short || def.label;
}
