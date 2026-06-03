import { useEffect, useState } from "react";
import {
  getLlmApiKeyFromMemory,
  isLocalLoopbackLlmConfig,
  readLlmRuntimeConfigFromStorage,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmHasStoredApiKey } from "../tauri/postprocessApi";

/** 刷新序号变化时，检查 localStorage 密钥引用是否能在本地安全存储中读回。 */
export function useLlmKeychainReady(refreshSeq: number): {
  keychainReady: boolean;
  checking: boolean;
} {
  const [keychainReady, setKeychainReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);

    const memoryKey = getLlmApiKeyFromMemory()?.trim();
    if (memoryKey) {
      setKeychainReady(true);
      setChecking(false);
      return;
    }

    const cfg = readLlmRuntimeConfigFromStorage();
    if (isLocalLoopbackLlmConfig(cfg)) {
      setKeychainReady(true);
      setChecking(false);
      return;
    }
    const apiKeyId = cfg.apiKeyId?.trim();
    if (!apiKeyId) {
      setKeychainReady(false);
      setChecking(false);
      return;
    }

    void llmHasStoredApiKey({ apiKeyId })
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
