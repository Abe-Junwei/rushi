import { describe, expect, it } from "vitest";
import { findDuplicateProjectNames, suggestUniqueProjectName } from "../utils/projectDuplicateName";

describe("findDuplicateProjectNames", () => {
  const projects = [
    { id: "a", name: "  口述史 A  ", updated_at_ms: 1 },
    { id: "b", name: "口述史 B", updated_at_ms: 2 },
  ];

  it("matches case-insensitively after trim", () => {
    expect(findDuplicateProjectNames(projects, "口述史 a")).toEqual([projects[0]]);
  });

  it("excludes current project id", () => {
    expect(findDuplicateProjectNames(projects, "口述史 A", "a")).toEqual([]);
  });

  it("returns empty for blank names", () => {
    expect(findDuplicateProjectNames(projects, "   ")).toEqual([]);
  });
});

describe("suggestUniqueProjectName", () => {
  it("appends numeric suffix when duplicate exists", () => {
    const projects = [{ id: "a", name: "场次", updated_at_ms: 1 }];
    expect(suggestUniqueProjectName(projects, "场次")).toBe("场次 (2)");
  });
});
