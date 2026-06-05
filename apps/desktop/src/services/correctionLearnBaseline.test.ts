import { describe, expect, it } from "vitest";
import {
  segmentsToLearnBaseline,
  segmentsToLearnBaselineAligned,
} from "./correctionLearnBaseline";

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

describe("segmentsToLearnBaselineAligned", () => {
  it("concatenates absorbed snapshot segments on merge", () => {
    const saved = [seg("u1", "左"), seg("u2", "右")];
    const current = [seg("u1", "左\n右")];
    expect(segmentsToLearnBaselineAligned(saved, current)).toEqual([
      { uid: "u1", text: "左\n右" },
    ]);
  });

  it("keeps full snapshot text for split left; new uid has empty baseline", () => {
    const saved = [seg("u1", "整段")];
    const current = [seg("u1", "左"), seg("u2", "右")];
    expect(segmentsToLearnBaselineAligned(saved, current)).toEqual([
      { uid: "u1", text: "整段" },
      { uid: "u2", text: "" },
    ]);
  });
});
