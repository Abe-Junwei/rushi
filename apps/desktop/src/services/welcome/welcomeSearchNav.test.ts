import { describe, expect, it } from "vitest";
import {
  buildWelcomeSearchNavItems,
  cycleWelcomeSearchScope,
  sliceWelcomeSearchResults,
} from "./welcomeSearchNav";

describe("welcomeSearchNav", () => {
  it("slices grouped preview limits for all scope", () => {
    const files = Array.from({ length: 8 }, (_, i) => ({
      project_id: "p",
      project_name: "P",
      file_id: `f${i}`,
      file_name: `file-${i}`,
      updated_at_ms: i,
      matched_field: "file_name",
    }));
    const content = Array.from({ length: 12 }, (_, i) => ({
      project_id: "p",
      project_name: "P",
      file_id: "f",
      file_name: "f",
      segment_idx: i,
      start_sec: 0,
      end_sec: 1,
      snippet: `hit-${i}`,
      char_start: 0,
      char_end: 1,
    }));
    const sliced = sliceWelcomeSearchResults("all", files, content);
    expect(sliced.files).toHaveLength(5);
    expect(sliced.content).toHaveLength(10);
  });

  it("builds nav items with files then content when querying", () => {
    const items = buildWelcomeSearchNavItems({
      queryEmpty: false,
      recentQueries: [],
      scope: "all",
      fileResults: [
        {
          project_id: "p",
          project_name: "P",
          file_id: "f1",
          file_name: "a",
          updated_at_ms: 1,
          matched_field: "file_name",
        },
      ],
      contentResults: [
        {
          project_id: "p",
          project_name: "P",
          file_id: "f2",
          file_name: "b",
          segment_idx: 0,
          start_sec: 0,
          end_sec: 1,
          snippet: "text",
          char_start: 0,
          char_end: 1,
        },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0]?.type).toBe("file");
    expect(items[1]?.type).toBe("content");
  });

  it("cycles scope chips", () => {
    expect(cycleWelcomeSearchScope("all", 1)).toBe("file");
    expect(cycleWelcomeSearchScope("file", 1)).toBe("content");
    expect(cycleWelcomeSearchScope("content", 1)).toBe("all");
  });
});
