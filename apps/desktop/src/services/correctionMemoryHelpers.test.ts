import { describe, expect, it } from "vitest";
import {
  correctionMemoryRowKey,
  correctionMemoryStableLabel,
  filterCorrectionMemoryRows,
  keyToCorrectionMemoryKey,
} from "./correctionMemoryHelpers";
import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";

const row = (partial: Partial<CorrectionMemoryEntryRow>): CorrectionMemoryEntryRow => ({
  wrong: "",
  right: "",
  hitCount: 0,
  acceptedAsRule: false,
  updatedAtMs: 0,
  isStable: false,
  ...partial,
});

describe("correctionMemoryHelpers", () => {
  it("stableLabel reflects accepted and hit threshold", () => {
    expect(correctionMemoryStableLabel(row({ acceptedAsRule: true }))).toBe("已采纳");
    expect(correctionMemoryStableLabel(row({ hitCount: 3 }))).toBe("已稳定");
    expect(correctionMemoryStableLabel(row({ hitCount: 1 }))).toBe("学习中");
  });

  it("rowKey round-trips", () => {
    const key = correctionMemoryRowKey({ wrong: "a", right: "b" });
    expect(keyToCorrectionMemoryKey(key)).toEqual({ wrong: "a", right: "b" });
  });

  it("filterCorrectionMemoryRows matches wrong or right", () => {
    const rows = [
      row({ wrong: "智控", right: "制控" }),
      row({ wrong: "foo", right: "bar" }),
    ];
    expect(filterCorrectionMemoryRows(rows, "智").map((r) => r.wrong)).toEqual(["智控"]);
  });
});
