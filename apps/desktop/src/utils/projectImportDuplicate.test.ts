import { describe, expect, it } from "vitest";
import {
  buildDuplicateImportConfirmBody,
  countStemAttachCandidates,
  formatDuplicateFileNames,
  hasImportDuplicate,
  importFileDisplayName,
  pickDuplicateOpenExistingFileId,
} from "./projectImportDuplicate";

describe("projectImportDuplicate", () => {
  it("hasImportDuplicate when path or hash matches", () => {
    expect(hasImportDuplicate({ bySourcePath: [], byContentHash: [] })).toBe(false);
    expect(
      hasImportDuplicate({
        bySourcePath: [{ fileId: "f1", fileName: "a" }],
        byContentHash: [],
      }),
    ).toBe(true);
  });

  it("builds confirm body with file names", () => {
    const body = buildDuplicateImportConfirmBody({
      bySourcePath: [{ fileId: "f1", fileName: "clip" }],
      byContentHash: [],
    });
    expect(body).toContain("clip");
    expect(body).toContain("不会覆盖");
  });

  it("formats duplicate names with cap", () => {
    expect(formatDuplicateFileNames([{ fileName: "a" }, { fileName: "b" }])).toBe("「a」、「b」");
  });

  it("prefers path match for open existing", () => {
    expect(
      pickDuplicateOpenExistingFileId({
        bySourcePath: [{ fileId: "path-id", fileName: "p" }],
        byContentHash: [{ fileId: "hash-id", fileName: "h" }],
      }),
    ).toBe("path-id");
  });

  it("countStemAttachCandidates matches paired and audio_only by name", () => {
    expect(
      countStemAttachCandidates(
        [
          { name: "采访", file_type: "paired" },
          { name: "采访", file_type: "text" },
          { name: "会议", file_type: "audio_only" },
        ],
        "采访",
      ),
    ).toBe(1);
    expect(countStemAttachCandidates(undefined, "采访")).toBe(0);
  });

  it("importFileDisplayName trims stem like Rust path_meta", () => {
    expect(importFileDisplayName("/tmp/ 采访 .srt", "text")).toBe("采访");
  });
});
