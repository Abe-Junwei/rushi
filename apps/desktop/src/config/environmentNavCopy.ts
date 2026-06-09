/** 用户可见的环境页导航路径（与 `EnvironmentPanel` 侧栏标签一致）。 */
export const ENV_NAV = {
  panel: "环境",
  localAsr: "环境 → 本机 ASR",
  onlineStt: "环境 → 在线 STT",
  llm: "环境 → LLM 配置",
  profile: "环境 → 配置迁移",
} as const;

export const LOCAL_SECRET_STORE_LABEL = "本地受保护存储";

/** @deprecated 使用 `LOCAL_SECRET_STORE_LABEL` 或 `localSecretStoreReferenceMessage`。 */
export function describeLocalProtectedSecretStore(): string {
  return LOCAL_SECRET_STORE_LABEL;
}

/** API Key 保存状态一行说明（LLM / 在线 STT 共用）。 */
export function localSecretStoreReferenceMessage(
  apiKeyId: string | null | undefined,
  keychainPresent: boolean | null,
): string {
  const label = apiKeyId?.trim();
  if (!label) return "未保存 Key。";
  if (keychainPresent === null) return `检查密钥（${label}）…`;
  if (keychainPresent) return `已保存（${label}）；留空即用。`;
  return `未找到密钥（${label}），请重新保存。`;
}
