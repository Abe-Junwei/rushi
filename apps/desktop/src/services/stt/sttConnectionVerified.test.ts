import { describe, expect, it } from "vitest";
import { sttRuntimeConnectionFingerprint } from "./sttOnlineProviderContract/connectionVerified";

describe("sttRuntimeConnectionFingerprint", () => {
  it("changes when persisted config fields change", () => {
    const base = {
      enabled: true,
      selectedProviderId: "openai",
      endpoint: undefined,
      appKey: undefined,
      timeoutMs: 30_000,
    };
    expect(sttRuntimeConnectionFingerprint(base)).not.toBe(
      sttRuntimeConnectionFingerprint({ ...base, endpoint: "https://api.test/v1/transcribe" }),
    );
    expect(sttRuntimeConnectionFingerprint(base)).not.toBe(
      sttRuntimeConnectionFingerprint({ ...base, enabled: false }),
    );
  });
});
