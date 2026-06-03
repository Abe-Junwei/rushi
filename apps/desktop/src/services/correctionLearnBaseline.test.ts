import { describe, expect, it } from "vitest";
import { segmentsToLearnBaseline } from "./correctionLearnBaseline";

function seg(uid: string, text: string) {
  return {
    idx: 0,
    uid,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("segmentsToLearnBaseline", () => {
  it("maps uid and text", () => {
    expect(segmentsToLearnBaseline([seg("u1", "旧"), seg("", "x")])).toEqual([
      { uid: "u1", text: "旧" },
    ]);
  });
});
