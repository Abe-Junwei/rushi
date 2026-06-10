import { describe, expect, it } from "vitest";
import { formatTranscribeDiagSummary, stageLabelZh } from "./transcribeDiag";

describe("transcribeDiag", () => {
  it("stageLabelZh maps known stages", () => {
    expect(stageLabelZh("transcribe")).toBe("转写");
    expect(stageLabelZh("preflight")).toBe("准备");
  });

  it("formatTranscribeDiagSummary surfaces failed stage and suggestion", () => {
    const lines = formatTranscribeDiagSummary({
      schemaVersion: 1,
      fileId: "f1",
      source: "local",
      startedAtMs: 1,
      outcome: "failed",
      failedStage: "transcribe",
      errorCode: "sidecar_connect",
      suggestedAction: "请到环境页重试侧车。",
      transcribeTimeline: [
        { stage: "preflight", startedAtMs: 1, endedAtMs: 2 },
        { stage: "transcribe", startedAtMs: 3, endedAtMs: 4, errorCode: "sidecar_connect" },
      ],
    });
    expect(lines[0]).toContain("转写");
    expect(lines.some((l) => l.includes("sidecar_connect"))).toBe(true);
    expect(lines.some((l) => l.includes("环境页"))).toBe(true);
  });

  it("formatTranscribeDiagSummary includes window progress", () => {
    const lines = formatTranscribeDiagSummary({
      schemaVersion: 1,
      fileId: "f1",
      source: "local",
      startedAtMs: 1,
      outcome: "success",
      windowIndex: 3,
      windowCount: 10,
      transcribeTimeline: [],
    });
    expect(lines.some((l) => l.includes("3/10"))).toBe(true);
  });
});
