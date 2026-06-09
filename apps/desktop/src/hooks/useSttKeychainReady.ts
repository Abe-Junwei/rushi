import { useEffect, useState } from "react";
import {
  getSttOnlineApiKeyFromMemory,
  readSttOnlineApiKeyIdFromStorage,
} from "../services/stt/sttOnlineProviderContract";
import { sttHasStoredApiKey } from "../tauri/sttApi";

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
    if (memoryKey) {
      setKeychainReady(true);
      setChecking(false);
      return;
    }

    const apiKeyId = readSttOnlineApiKeyIdFromStorage();
    if (!apiKeyId) {
      setKeychainReady(false);
      setChecking(false);
      return;
    }

    void sttHasStoredApiKey({ apiKeyId })
      .then((ok) => {
        if (!cancelled) {
          setKeychainReady(ok);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKeychainReady(false);
          setChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshSeq]);

  return { keychainReady, checking };
}
