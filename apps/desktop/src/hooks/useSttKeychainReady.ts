import { useEffect, useState } from "react";
import {
  getSttOnlineApiKeyFromMemory,
  getSttOnlineApiSecretFromMemory,
  readSttOnlineApiKeyIdFromStorage,
  readSttOnlineApiSecretIdFromStorage,
} from "../services/stt/sttOnlineProviderContract";
import { sttHasStoredApiKey } from "../tauri/sttApi";

async function storedSecretExists(apiKeyId: string): Promise<boolean> {
  try {
    return await sttHasStoredApiKey({ apiKeyId });
  } catch {
    return false;
  }
}

/** 刷新序号变化时，检查 localStorage 密钥引用是否能在本地安全存储中读回。 */
export function useSttKeychainReady(refreshSeq: number): {
  keychainReady: boolean;
  checking: boolean;
} {
  const [keychainReady, setKeychainReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);

    const memoryKey = getSttOnlineApiKeyFromMemory()?.trim();
    const memorySecret = getSttOnlineApiSecretFromMemory()?.trim();
    const apiKeyId = readSttOnlineApiKeyIdFromStorage();
    const apiSecretId = readSttOnlineApiSecretIdFromStorage();

    if (memoryKey && (!apiSecretId || memorySecret)) {
      setKeychainReady(true);
      setChecking(false);
      return;
    }

    if (!apiKeyId && !apiSecretId) {
      setKeychainReady(false);
      setChecking(false);
      return;
    }

    void (async () => {
      try {
        const keyOk = memoryKey ? true : apiKeyId ? await storedSecretExists(apiKeyId) : true;
        const secretOk = memorySecret
          ? true
          : apiSecretId
            ? await storedSecretExists(apiSecretId)
            : true;
        if (!cancelled) {
          setKeychainReady(keyOk && secretOk);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setKeychainReady(false);
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSeq]);

  return { keychainReady, checking };
}
