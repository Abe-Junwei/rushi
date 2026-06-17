import { describe, expect, it, vi } from "vitest";
import {
  importAudioPathsToProject,
  importDroppedPathsToProject,
  resolveDroppedFileKind,
} from "./projectBatchImport";

describe("projectBatchImport", () => {
  it("resolveDroppedFileKind maps extensions", () => {
    expect(resolveDroppedFileKind("/a/foo.mp3")).toBe("audio");
    expect(resolveDroppedFileKind("/a/foo.srt")).toBe("transcript");
    expect(resolveDroppedFileKind("/a/foo.pdf")).toBeNull();
  });

  it("importDroppedPathsToProject reloads once after successes", async () => {
    const importFile = vi.fn(async (_kind, path: string) => path.endsWith("a.mp3") || path.endsWith("c.txt"));
    const reload = vi.fn(async () => {});
    const result = await importDroppedPathsToProject(
      importFile,
      ["/a/a.mp3", "/a/b.pdf", "/a/c.txt"],
      reload,
    );
    expect(result).toEqual({ imported: 2, skipped: 1, unsupported: 1 });
    expect(importFile).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("importAudioPathsToProject dedupes paths", async () => {
    const importFile = vi.fn(async () => true);
    const reload = vi.fn(async () => {});
    const result = await importAudioPathsToProject(importFile, ["/a/x.mp3", "/a/x.mp3"], reload);
    expect(result).toEqual({ imported: 1, skipped: 0 });
    expect(importFile).toHaveBeenCalledTimes(1);
  });
});
