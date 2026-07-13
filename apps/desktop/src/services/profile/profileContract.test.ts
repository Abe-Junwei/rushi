import { beforeEach, describe, expect, it } from "vitest";
import {
  applySettingsProfileV1,
  buildSettingsProfileV1,
  type SettingsProfileV1,
} from "./profileContract";
import {
  DEFAULT_LLM_API_KEY_ID,
  applyLlmProviderPreset,
  persistLlmRuntimeConfig,
  persistLlmPromptOverrides,
  readLlmPromptOverridesFromStorage,
  setLlmApiKeyInMemory,
} from "../postprocess/postprocessRuntimeContract";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
  STT_ONLINE_PROVIDER_STORAGE_KEYS,
} from "../stt/sttOnlineProviderContract";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

describe("profileContract", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
    setLlmApiKeyInMemory(null);
  });

  it("builds a profile without secret api_key", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    setLlmApiKeyInMemory("sk-secret-should-not-export");
    persistExternalSttOnlineRuntimeConfig(
      normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: "openai",
        endpoint: "https://api.openai.com/v1/audio/transcriptions",
        appKey: "project-id",
        timeoutMs: 45000,
      }),
    );

    const profile = buildSettingsProfileV1();
    expect(profile.version).toBe(2);
    expect(profile.editor?.tab_advance_loops_segment).toBe(true);
    const dumped = JSON.stringify(profile);
    expect(profile.llm?.api_key_id).toBe(DEFAULT_LLM_API_KEY_ID);
    expect(dumped).not.toContain("sk-secret-should-not-export");
    expect((profile.llm as { api_key?: string }).api_key).toBeUndefined();
  });

  it("exports and imports llm prompt overrides", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    persistLlmPromptOverrides({
      stageBSystem: "profile system",
      autoPunctuateInstructions: "profile auto",
      exportPolishSystem: "profile export",
    });

    const profile = buildSettingsProfileV1();
    expect(profile.llm?.prompt).toEqual({
      stage_b_system: "profile system",
      auto_punctuate_instructions: "profile auto",
      export_polish_system: "profile export",
    });

    localStorage.clear();
    applySettingsProfileV1(profile);
    expect(readLlmPromptOverridesFromStorage()).toEqual({
      stageBSystem: "profile system",
      autoPunctuateInstructions: "profile auto",
      exportPolishSystem: "profile export",
    });
  });

  it("import without prompt leaves existing prompt overrides unchanged", () => {
    persistLlmPromptOverrides({ stageBSystem: "keep me" });
    applySettingsProfileV1({
      version: 1,
      llm: {
        provider_id: "deepseek",
        base_url: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      },
    });
    expect(readLlmPromptOverridesFromStorage()).toEqual({ stageBSystem: "keep me" });
  });

  it("applies llm and online stt sections back to storage", () => {
    const profile: SettingsProfileV1 = {
      version: 1,
      llm: {
        provider_id: "qwen",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
        api_key_id: "work",
      },
      online_stt: {
        enabled: true,
        provider_id: "custom-proxy",
        endpoint: "https://example.com/transcribe",
        app_key: "proj-a",
        timeout_ms: 90000,
      },
    };

    applySettingsProfileV1(profile);

    expect(localStorage.getItem("rushi.llm.providerId")).toBe("qwen");
    expect(localStorage.getItem("rushi.llm.apiKeyId")).toBe("work");
    const stt = readExternalSttOnlineRuntimeConfigFromStorage();
    expect(stt.selectedProviderId).toBe("custom-proxy");
    expect(stt.endpoint).toBe("https://example.com/transcribe");
    expect(stt.appKey).toBe("proj-a");
    expect(localStorage.getItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs)).toBe("90000");
  });

  it("rejects unknown llm providers", () => {
    expect(() =>
      applySettingsProfileV1({
        version: 1,
        llm: {
          provider_id: "unknown" as never,
          base_url: "https://example.com/v1",
          model: "foo",
        },
      }),
    ).toThrow("不支持的 LLM provider");
  });

  it("roundtrips editor preferences on v2 import", () => {
    applySettingsProfileV1({
      version: 2,
      editor: {
        tab_advance_loops_segment: false,
        waveform_minimap: false,
        playback_scroll_follow: "edge",
        transcript_playback_follow: false,
        global_playback_rate: 1.5,
        transcript_font_px: 16,
        waveform_height_px: 180,
      },
    });

    expect(localStorage.getItem("rushi.p1.tabAdvanceLoopsSegment")).toBe("0");
    expect(localStorage.getItem("rushi.p1.waveformMinimap")).toBe("0");
    expect(localStorage.getItem("rushi.p1.waveformPlaybackScrollFollow")).toBe("edge");
    expect(localStorage.getItem("rushi.p1.transcriptPlaybackFollow")).toBe("0");
    expect(localStorage.getItem("rushi.p1.waveformGlobalPlaybackRate")).toBe("1.5");
    expect(localStorage.getItem("rushi.p1.transcriptFontPx")).toBe("16");
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBe("180");
  });
});
