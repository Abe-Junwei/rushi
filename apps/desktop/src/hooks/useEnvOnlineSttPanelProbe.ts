import { useCallback, useState } from "react";
import { formatSttProbeFailureMessage } from "../services/stt/sttProbeUserMessage";
import { toast } from "../services/ui/toast";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";
import {
  ensureSttOnlineApiKeyForSession,
  ensureSttOnlineApiSecretForSession,
  getSttOnlineProviderDefinition,
  hasSttOnlineApiKeyReference,
  hasSttOnlineApiSecretReference,
  markSttConnectionVerified,
  normalizeSttApiKeyId,
  persistExternalSttOnlineRuntimeConfig,
  persistSttOnlineApiSecretId,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  readSttOnlineApiSecretIdFromStorage,
  resolveSttApiKeyIdForProvider,
  resolveSttApiSecretIdForProvider,
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
  syncSttOnlineProviderProfileFromActive,
} from "../services/stt/sttOnlineProviderContract";
import { sttSaveApiKey } from "../tauri/sttApi";
import {
  buildOnlineSttDraftRuntimeConfig,
  type EnvOnlineSttFormFields,
} from "./envOnlineSttPanelDraft";

export type UseEnvOnlineSttPanelProbeArgs = {
  fields: EnvOnlineSttFormFields;
  setOlApiKey: (v: string) => void;
  setOlApiSecret: (v: string) => void;
  setSavedApiKeyId: (v: string | null) => void;
  setSavedApiSecretId: (v: string | null) => void;
  bumpKeychainCheck: () => void;
  onSttOnlineRuntimeChanged?: () => void;
};

export function useEnvOnlineSttPanelProbe({
  fields,
  setOlApiKey,
  setOlApiSecret,
  setSavedApiKeyId,
  setSavedApiSecretId,
  bumpKeychainCheck,
  onSttOnlineRuntimeChanged,
}: UseEnvOnlineSttPanelProbeArgs) {
  const [probeBusy, setProbeBusy] = useState(false);
  const [lastProbeAvailable, setLastProbeAvailable] = useState<boolean | null>(null);

  const invalidateProbe = useCallback(() => {
    setLastProbeAvailable(null);
  }, []);

  const probeOnlineStt = useCallback(async () => {
    const startedAt = Date.now();
    setProbeBusy(true);
    const { olProviderId, olApiKey, olApiSecret, savedApiKeyId, savedApiSecretId } = fields;
    try {
      const typedApiKey = olApiKey.trim();
      const typedApiSecret = olApiSecret.trim();
      const providerDef = getSttOnlineProviderDefinition(olProviderId);
      const providerApiKeyId = resolveSttApiKeyIdForProvider(olProviderId);
      const providerApiSecretId = resolveSttApiSecretIdForProvider(olProviderId);
      const apiKeyLabel = providerDef?.credentialFieldLabel ?? "API Key";
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      let nextApiSecretId = normalizeSttApiKeyId(
        savedApiSecretId ?? readSttOnlineApiSecretIdFromStorage(),
      );
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: providerApiKeyId,
          apiKey: typedApiKey,
        });
        setSavedApiKeyId(nextApiKeyId ?? providerApiKeyId);
        setOlApiKey("");
      }
      if (!nextApiKeyId && !hasSttOnlineApiKeyReference()) {
        throw new Error(`请先填写 ${apiKeyLabel}，再点击探测连接。`);
      }
      if (providerDef?.requiresApiSecret) {
        if (typedApiSecret && providerApiSecretId) {
          nextApiSecretId = await sttSaveApiKey({
            apiKeyId: providerApiSecretId,
            apiKey: typedApiSecret,
          });
          persistSttOnlineApiSecretId(nextApiSecretId);
          setSavedApiSecretId(nextApiSecretId ?? providerApiSecretId);
          setOlApiSecret("");
        } else if (!hasSttOnlineApiSecretReference()) {
          throw new Error("请先填写 APISecret，再点击探测连接。");
        }
      }
      if (typedApiKey) {
        setSttOnlineApiKeyInMemory(typedApiKey);
      } else {
        await ensureSttOnlineApiKeyForSession();
      }
      await ensureSttOnlineApiSecretForSession();
      const cfg = buildOnlineSttDraftRuntimeConfig(fields);
      const r = await probeExternalSttOnlineHealth({
        runtimeConfig: {
          ...cfg,
          apiKeyId: nextApiKeyId ?? savedApiKeyId ?? providerApiKeyId,
          ...(nextApiSecretId ?? savedApiSecretId
            ? { apiSecretId: nextApiSecretId ?? savedApiSecretId ?? providerApiSecretId }
            : {}),
        },
      });
      setLastProbeAvailable(r.available);
      if (r.available) {
        const verifiedCfg = {
          ...cfg,
          apiKeyId: nextApiKeyId ?? savedApiKeyId ?? providerApiKeyId,
          ...(nextApiSecretId ?? savedApiSecretId
            ? { apiSecretId: nextApiSecretId ?? savedApiSecretId ?? providerApiSecretId }
            : {}),
        };
        persistExternalSttOnlineRuntimeConfig(verifiedCfg);
        markSttConnectionVerified(verifiedCfg);
        syncSttOnlineProviderProfileFromActive(verifiedCfg);
        setSttOnlineApiKeyInMemory(null);
        setSttOnlineApiSecretInMemory(null);
        bumpKeychainCheck();
        toast.success(`在线 STT 可达（约 ${r.latencyMs ?? "?"} ms）`);
      } else {
        toast.error(formatSttProbeFailureMessage(r));
      }
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      setLastProbeAvailable(false);
      toast.errorFromUnknown(e);
    } finally {
      await waitMinVisibleBusy(startedAt);
      setProbeBusy(false);
    }
  }, [
    bumpKeychainCheck,
    fields,
    onSttOnlineRuntimeChanged,
    setOlApiKey,
    setOlApiSecret,
    setSavedApiKeyId,
    setSavedApiSecretId,
  ]);

  return {
    probeBusy,
    lastProbeAvailable,
    invalidateProbe,
    probeOnlineStt,
  };
}
