import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_API_KEY_ID,
  applyLlmProviderPreset,
  persistLlmRuntimeConfig,
  tryBuildPostprocessRuntimeBridge,
} from "./postprocessRuntimeContract";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, String(value));
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => data.clear(),
    },
  });
}

describe("postprocess IPC contract", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });
  it("builds camelCase runtime bridge for Tauri invoke", () => {
    persistLlmRuntimeConfig({
      ...applyLlmProviderPreset("deepseek"),
      apiKeyId: DEFAULT_LLM_API_KEY_ID,
    });
    const runtime = tryBuildPostprocessRuntimeBridge();
    expect(runtime).toEqual({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKeyId: DEFAULT_LLM_API_KEY_ID,
      allowInsecureHttp: undefined,
    });
    expect(Object.keys(runtime ?? {})).not.toContain("base_url");
    expect(Object.keys(runtime ?? {})).not.toContain("api_key_id");
  });
});
