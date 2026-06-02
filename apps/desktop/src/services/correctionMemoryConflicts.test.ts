import { describe, expect, it } from "vitest";
import { groupCorrectionMemoryConflicts } from "./correctionMemoryConflicts";

describe("groupCorrectionMemoryConflicts", () => {
  it("groups same wrong with different rights", () => {
    const groups = groupCorrectionMemoryConflicts([
      { wrong: "脸喉", right: "敛喉", hitCount: 3, updatedAtMs: 1, acceptedAsRule: false, isStable: true },
      { wrong: "脸喉", right: "练喉", hitCount: 1, updatedAtMs: 2, acceptedAsRule: false, isStable: false },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.wrong).toBe("脸喉");
    expect(groups[0]?.entries.map((e) => e.right).sort()).toEqual(["敛喉", "练喉"]);
  });

  it("ignores single-right wrong forms", () => {
    const groups = groupCorrectionMemoryConflicts([
      { wrong: "a", right: "b", hitCount: 1, updatedAtMs: 1, acceptedAsRule: false, isStable: false },
    ]);
    expect(groups).toHaveLength(0);
  });
});
