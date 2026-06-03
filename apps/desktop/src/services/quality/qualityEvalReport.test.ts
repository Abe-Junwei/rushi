import { describe, expect, it } from "vitest";
import {
  compareQualityReports,
  summarizeQualityReport,
  type QualityEvalReport,
} from "./qualityEvalReport";

const sample: QualityEvalReport = {
  schemaVersion: "1",
  manifest: "fixtures/eval/eval_manifest.v1.json",
  asrBase: "http://127.0.0.1:8741",
  items: [
    { id: "a", cerChars: 0.2, termHitRate: 0.5 },
    { id: "proper-noun-zhikong", cerChars: 0.1, termHitRate: 1 },
  ],
};

describe("summarizeQualityReport", () => {
  it("aggregates mean cer and gate term hit", () => {
    const s = summarizeQualityReport(sample);
    expect(s.itemCount).toBe(2);
    expect(s.meanCer).toBeCloseTo(0.15);
    expect(s.gateTermHit).toBe(1);
  });
});

describe("compareQualityReports", () => {
  it("computes deltas against baseline", () => {
    const baseline: QualityEvalReport = {
      ...sample,
      items: [
        { id: "a", cerChars: 0.3, termHitRate: 0.4 },
        { id: "proper-noun-zhikong", cerChars: 0.2, termHitRate: 0.8 },
      ],
    };
    const d = compareQualityReports(sample, baseline);
    expect(d?.meanCerDelta).toBeCloseTo(-0.1);
    expect(d?.gateTermHitDelta).toBeCloseTo(0.2);
  });
});
