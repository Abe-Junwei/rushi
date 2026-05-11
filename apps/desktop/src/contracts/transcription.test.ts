import { describe, expect, it } from "vitest";
import { isTranscriptionResult, TRANSCRIPTION_RESULT_SCHEMA_VERSION } from "./transcription";

describe("isTranscriptionResult", () => {
  it("accepts minimal valid payload", () => {
    const v = {
      schema_version: TRANSCRIPTION_RESULT_SCHEMA_VERSION,
      segments: [
        {
          start_sec: 0,
          end_sec: 1,
          text: "a",
          confidence: null,
        },
      ],
      full_text: "a",
      engine: "stub",
      duration_sec: 1,
      warnings: [],
    };
    expect(isTranscriptionResult(v)).toBe(true);
  });

  it("rejects wrong schema version", () => {
    expect(
      isTranscriptionResult({
        schema_version: "0",
        segments: [],
        full_text: "",
        engine: "x",
        duration_sec: null,
        warnings: [],
      }),
    ).toBe(false);
  });
});
