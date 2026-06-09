/** 已存 Key 在 password 输入框中的占位密文（非真实密钥）。 */
export const SAVED_API_KEY_MASK = "••••••••••••••••••••••••";

export function resolveSavedApiKeyInputDisplay(args: {
  typedApiKey: string;
  savedApiKeyId: string | null | undefined;
  keychainReady?: boolean | null;
}): string {
  if (args.typedApiKey.length > 0) return args.typedApiKey;
  if (!args.savedApiKeyId?.trim()) return "";
  if (args.keychainReady === false) return "";
  return SAVED_API_KEY_MASK;
}

export function isSavedApiKeyMaskDisplayed(
  typedApiKey: string,
  savedApiKeyId: string | null | undefined,
  keychainReady?: boolean | null,
): boolean {
  return (
    typedApiKey.length === 0 &&
    Boolean(savedApiKeyId?.trim()) &&
    keychainReady !== false
  );
}

/** 将输入框变更归一为仅含用户新输入的 draft（不含 mask 字符）。 */
export function normalizeSavedApiKeyInputChange(
  nextValue: string,
  wasShowingMask: boolean,
): string {
  if (!wasShowingMask) return nextValue;
  if (nextValue === "" || nextValue === SAVED_API_KEY_MASK) return "";
  return nextValue.replace(/•/g, "");
}
