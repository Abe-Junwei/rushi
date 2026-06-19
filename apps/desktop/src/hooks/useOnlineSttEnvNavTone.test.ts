import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnlineSttEnvNavTone } from "./useOnlineSttEnvNavTone";
import {
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
} from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";

function installMockLocalStorage() {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  });
}

describe("useOnlineSttEnvNavTone", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("updates when STT_ONLINE_RUNTIME_CHANGED_EVENT fires", () => {
    const { result } = renderHook(() => useOnlineSttEnvNavTone());
    expect(result.current).toBe("warn");

    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      accent: "mandarin",
      timeoutMs: 600_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    markSttConnectionVerified(cfg);

    act(() => {
      window.dispatchEvent(new CustomEvent(STT_ONLINE_RUNTIME_CHANGED_EVENT));
    });

    expect(result.current).toBe("ok");
  });
});
