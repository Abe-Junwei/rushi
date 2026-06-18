import { useCallback, useState } from "react";
import { toast } from "../services/ui/toast";
import {
  clearSttConnectionVerified,
  DEFAULT_STT_API_KEY_ID,
  getSttOnlineProviderDefinition,
  hasSttOnlineApiSecretReference,
  IFLYTEK_STT_API_KEY_ID,
  IFLYTEK_STT_API_SECRET_ID,
  normalizeSttApiKeyId,
  persistExternalSttOnlineRuntimeConfig,
  persistSttOnlineApiSecretId,
  readExternalSttOnlineRuntimeConfigFromStorage,
  readSttOnlineApiSecretIdFromStorage,
  resolveSttApiKeyIdForProvider,
  resolveSttApiSecretIdForProvider,
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
} from "../services/stt/sttOnlineProviderContract";
import { sttDeleteApiKey, sttSaveApiKey } from "../tauri/sttApi";
import { buildOnlineSttDraftRuntimeConfig, type EnvOnlineSttFormFields } from "./envOnlineSttPanelDraft";

export type UseEnvOnlineSttPanelCredentialActionsArgs = {
  fields: EnvOnlineSttFormFields;
  setOlApiKey: (v: string) => void;
  setOlApiSecret: (v: string) => void;
  setSavedApiKeyId: (v: string | null) => void;
  setSavedApiSecretId: (v: string | null) => void;
  bumpKeychainCheck: () => void;
  onSttOnlineRuntimeChanged?: () => void;
  onInvalidateProbe: () => void;
};

export function useEnvOnlineSttPanelCredentialActions({
  fields,
  setOlApiKey,
  setOlApiSecret,
  setSavedApiKeyId,
  setSavedApiSecretId,
  bumpKeychainCheck,
  onSttOnlineRuntimeChanged,
  onInvalidateProbe,
}: UseEnvOnlineSttPanelCredentialActionsArgs) {
  const [saveBusy, setSaveBusy] = useState(false);

  const saveOnlineStt = useCallback(async () => {
    onInvalidateProbe();
    setSaveBusy(true);
    const { olProviderId, olApiKey, olApiSecret, savedApiKeyId, savedApiSecretId } = fields;
    try {
      const typedApiKey = olApiKey.trim();
      const typedApiSecret = olApiSecret.trim();
      const providerDef = getSttOnlineProviderDefinition(olProviderId);
      const providerApiKeyId = resolveSttApiKeyIdForProvider(olProviderId);
      const providerApiSecretId = resolveSttApiSecretIdForProvider(olProviderId);
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      let nextApiSecretId = normalizeSttApiKeyId(
        savedApiSecretId ?? readSttOnlineApiSecretIdFromStorage(),
      );
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: providerApiKeyId,
          apiKey: typedApiKey,
        });
        clearSttConnectionVerified();
      }
      if (providerDef?.requiresApiSecret && typedApiSecret && providerApiSecretId) {
        nextApiSecretId = await sttSaveApiKey({
          apiKeyId: providerApiSecretId,
          apiKey: typedApiSecret,
        });
        clearSttConnectionVerified();
      }
      const apiKeyLabel = providerDef?.credentialFieldLabel ?? "API Key";
      if (!nextApiKeyId) {
        throw new Error(`请先填写 ${apiKeyLabel}，再点击保存在线配置。`);
      }
      if (providerDef?.requiresApiSecret && !nextApiSecretId && !hasSttOnlineApiSecretReference()) {
        throw new Error("请先填写 APISecret，再点击保存在线配置。");
      }
      const n = buildOnlineSttDraftRuntimeConfig(fields);
      persistExternalSttOnlineRuntimeConfig({
        ...n,
        apiKeyId: nextApiKeyId,
        ...(nextApiSecretId ? { apiSecretId: nextApiSecretId } : {}),
      });
      setSavedApiKeyId(nextApiKeyId);
      if (nextApiSecretId) {
        persistSttOnlineApiSecretId(nextApiSecretId);
        setSavedApiSecretId(nextApiSecretId);
      }
      setSttOnlineApiKeyInMemory(null);
      if (typedApiSecret) {
        setSttOnlineApiSecretInMemory(null);
        setOlApiSecret("");
      }
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      if (typedApiKey) {
        setOlApiKey("");
        toast.success(`${apiKeyLabel} 已保存，请重新探测连接。`);
      } else {
        toast.success("已保存，沿用已存 Key。");
      }
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setSaveBusy(false);
    }
  }, [
    bumpKeychainCheck,
    fields,
    onInvalidateProbe,
    onSttOnlineRuntimeChanged,
    setOlApiKey,
    setOlApiSecret,
    setSavedApiKeyId,
    setSavedApiSecretId,
  ]);

  const clearSavedApiKey = useCallback(async () => {
    const { olProviderId, savedApiKeyId, savedApiSecretId } = fields;
    const stored = readExternalSttOnlineRuntimeConfigFromStorage();
    if (!savedApiKeyId && !stored.apiKeyId && !savedApiSecretId && !stored.apiSecretId) return;
    setSaveBusy(true);
    try {
      const rawId = savedApiKeyId ?? stored.apiKeyId;
      const rawSecretId = savedApiSecretId ?? stored.apiSecretId;
      const ids = new Set<string>([
        DEFAULT_STT_API_KEY_ID,
        IFLYTEK_STT_API_KEY_ID,
        IFLYTEK_STT_API_SECRET_ID,
        resolveSttApiKeyIdForProvider(olProviderId),
      ]);
      const secretSlot = resolveSttApiSecretIdForProvider(olProviderId);
      if (secretSlot) ids.add(secretSlot);
      if (rawId?.trim()) ids.add(rawId.trim());
      if (rawSecretId?.trim()) ids.add(rawSecretId.trim());
      for (const id of ids) {
        await sttDeleteApiKey({ apiKeyId: id }).catch(() => {
          /* ignore missing legacy entries */
        });
      }
      const n = buildOnlineSttDraftRuntimeConfig(fields);
      persistExternalSttOnlineRuntimeConfig(n, { clearApiKeyId: true, clearApiSecretId: true });
      persistSttOnlineApiSecretId(null, { clearApiSecretId: true });
      setSavedApiKeyId(null);
      setSavedApiSecretId(null);
      setOlApiKey("");
      setOlApiSecret("");
      setSttOnlineApiKeyInMemory(null);
      setSttOnlineApiSecretInMemory(null);
      clearSttConnectionVerified();
      onInvalidateProbe();
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      toast.success("已清除本地保存的密钥。");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setSaveBusy(false);
    }
  }, [
    bumpKeychainCheck,
    fields,
    onInvalidateProbe,
    onSttOnlineRuntimeChanged,
    setOlApiKey,
    setOlApiSecret,
    setSavedApiKeyId,
    setSavedApiSecretId,
  ]);

  return { saveBusy, saveOnlineStt, clearSavedApiKey };
}
