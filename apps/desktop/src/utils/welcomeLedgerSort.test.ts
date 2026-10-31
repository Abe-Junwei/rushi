import { describe, expect, it } from "vitest";
import {
  nextListId,
  sortRecentFilesByMode,
  sortWelcomeProjectsByMode,
} from "./welcomeLedgerSort";

describe("welcomeLedgerSort", () => {
  it("sorts projects by updated, created, then name", () => {
    const list = [
      { id: "a", name: "乙", created_at_ms: 9, updated_at_ms: 1 },
      { id: "b", name: "甲", created_at_ms: 1, updated_at_ms: 3 },
      { id: "c", name: "丙", created_at_ms: 5, updated_at_ms: 2 },
    ];
    expect(sortWelcomeProjectsByMode(list, "updated").map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortWelcomeProjectsByMode(list, "created").map((p) => p.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortWelcomeProjectsByMode(list, "name").map((p) => p.name)).toEqual([
      "丙",
      "甲",
      "乙",
    ]);
  });

  it("sorts recent files by name and created", () => {
    const files = [
      {
        projectId: "p",
        fileId: "1",
        name: "开示",
        fileType: "paired",
        createdAtMs: 5,
        updatedAtMs: 1,
        summary: {} as never,
      },
      {
        projectId: "p",
        fileId: "2",
        name: "阿含",
        fileType: "paired",
        createdAtMs: 1,
        updatedAtMs: 9,
        summary: {} as never,
      },
    ];
    expect(sortRecentFilesByMode(files, "name").map((f) => f.name)).toEqual([
      "阿含",
      "开示",
    ]);
    expect(sortRecentFilesByMode(files, "created").map((f) => f.fileId)).toEqual([
      "1",
      "2",
    ]);
  });

  it("picks the next id after rename", () => {
    expect(nextListId(["a", "b", "c"], "b")).toBe("c");
    expect(nextListId(["a", "b", "c"], "c")).toBe("b");
    expect(nextListId(["a"], "a")).toBeNull();
  });
});
