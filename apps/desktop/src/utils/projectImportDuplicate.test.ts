import { describe, expect, it } from "vitest";
import {
  buildDuplicateImportConfirmBody,
  formatDuplicateFileNames,
  hasImportDuplicate,
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
});
