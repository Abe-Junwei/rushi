import { describe, expect, it } from "vitest";
import { onlineTranscribeProviderShortLabel } from "./onlineTranscribeProviderShortLabel";

describe("onlineTranscribeProviderShortLabel", () => {
  it("maps china vendors to compact busy-overlay labels", () => {
    expect(onlineTranscribeProviderShortLabel("dashscope-asr")).toBe("百炼");
    expect(onlineTranscribeProviderShortLabel("iflytek-speed-asr")).toBe("讯飞极速大模型");
  });

  it("falls back to catalog label prefix for other known providers", () => {
    expect(onlineTranscribeProviderShortLabel("openai")).toBe("OpenAI");
    expect(onlineTranscribeProviderShortLabel("custom-proxy")).toBe("自定义代理");
  });

  it("returns 云端 for unknown provider ids", () => {
    expect(onlineTranscribeProviderShortLabel("not-a-provider")).toBe("云端");
  });
});
