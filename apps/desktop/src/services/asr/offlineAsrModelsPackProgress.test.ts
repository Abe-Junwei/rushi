import { describe, expect, it } from "vitest";
import {
  computeOfflineImportWeightedPercent,
  offlineImportProgressLabel,
} from "./offlineAsrModelsPackProgress";

describe("offlineAsrModelsPackProgress", () => {
  it("maps phase-local percent to monotonic overall percent", () => {
    expect(computeOfflineImportWeightedPercent("extract", 100)).toBe(5);
    expect(computeOfflineImportWeightedPercent("copy", 50)).toBe(25);
    expect(computeOfflineImportWeightedPercent("merge", 100)).toBe(95);
    expect(computeOfflineImportWeightedPercent("validate", 100)).toBe(100);
  });

  it("builds user-facing progress labels from weighted percent", () => {
    expect(offlineImportProgressLabel("merge", 72)).toBe("正在写入本机缓存… 72%");
    expect(offlineImportProgressLabel("validate", 100)).toBe("正在校验模型完整性…");
  });
});
