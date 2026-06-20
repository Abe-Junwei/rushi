import { describe, expect, it } from "vitest";
import { resolveLegacyWaveformFallbackFile } from "./legacyWaveformFallback";

describe("resolveLegacyWaveformFallbackFile", () => {
  const files = [
    { id: "paired-1", name: "采访", file_type: "paired", updated_at_ms: 2 },
    { id: "text-1", name: "采访", file_type: "text", updated_at_ms: 1 },
  ];

  it("returns null when current file already has audio", () => {
    expect(resolveLegacyWaveformFallbackFile("paired-1", files, true)).toBeNull();
  });

  it("returns null for paired file without loaded audio (attach path)", () => {
    expect(resolveLegacyWaveformFallbackFile("paired-1", files, false)).toBeNull();
  });

  it("offers audio file when editing legacy split text file", () => {
    expect(resolveLegacyWaveformFallbackFile("text-1", files, false)?.id).toBe("paired-1");
  });
});
