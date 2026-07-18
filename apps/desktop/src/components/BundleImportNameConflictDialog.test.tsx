import { describe, expect, it } from "vitest";
import {
  draftsFromPreview,
  resolutionsFromDrafts,
} from "./BundleImportNameConflictDialog";
import type { ExchangeBundleImportPreview } from "../tauri/projectCrudApi";

const preview: ExchangeBundleImportPreview = {
  zipPath: "/tmp/a.zip",
  kind: "rushi_project_bundle",
  conflicts: [
    {
      id: "c0",
      incomingName: "开示",
      suggestedName: "开示 (2)",
      existingFileId: "f1",
      existingProjectId: "p1",
      existingProjectName: "旧项目",
      sourceProjectLabel: "导入项目",
      sourceKey: "src1",
    },
    {
      id: "c1",
      incomingName: "仅包内重名",
      suggestedName: "仅包内重名 (2)",
      existingFileId: null,
      sourceProjectLabel: "导入项目",
      sourceKey: "src1",
    },
  ],
};

describe("BundleImportNameConflictDialog helpers", () => {
  it("defaults overwrite when existing file present, else rename", () => {
    const drafts = draftsFromPreview(preview);
    expect(drafts.c0?.action).toBe("overwrite");
    expect(drafts.c1?.action).toBe("rename");
    expect(drafts.c1?.renameTo).toBe("仅包内重名 (2)");
  });

  it("maps drafts to resolutions", () => {
    const drafts = draftsFromPreview(preview);
    expect(resolutionsFromDrafts(preview, drafts)).toEqual([
      { id: "c0", action: "overwrite", renameTo: null },
      { id: "c1", action: "rename", renameTo: "仅包内重名 (2)" },
    ]);
    const renamed = {
      c0: { action: "rename" as const, renameTo: " 开示 (2) " },
      c1: { action: "rename" as const, renameTo: "仅包内重名 (2)" },
    };
    expect(resolutionsFromDrafts(preview, renamed)[0]).toEqual({
      id: "c0",
      action: "rename",
      renameTo: "开示 (2)",
    });
  });
});
