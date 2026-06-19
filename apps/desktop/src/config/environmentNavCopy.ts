/** 用户可见的设置面板导航路径（与 `EnvironmentPanel` 侧栏标签一致）。 */
export const ENV_NAV = {
  panel: "设置",
  localAsr: "设置 → 本机 ASR",
  onlineStt: "设置 → 在线 STT",
  llm: "设置 → LLM 配置",
  shortcuts: "设置 → 快捷键",
  profile: "设置 → 配置迁移",
  quality: "设置 → 质量评测",
  about: "设置 → 关于",
} as const;

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
