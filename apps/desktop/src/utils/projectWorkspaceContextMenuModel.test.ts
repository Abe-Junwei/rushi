import { describe, expect, it } from "vitest";
import {
  buildProjectContextMenuItems,
  buildProjectFileContextMenuItems,
  parseCopyDestProjectId,
  parseMoveDestProjectId,
} from "./projectWorkspaceContextMenuModel";

describe("projectWorkspaceContextMenuModel", () => {
  it("builds project row actions including hub-migrated items", () => {
    const items = buildProjectContextMenuItems({ isExpanded: false });
    expect(items.map((i) => i.key)).toEqual([
      "toggleExpand",
      "revealLocation",
      "projectInfo",
      "importAudio",
      "importText",
      "batchTranscribe",
      "rename",
      "delete",
    ]);
    expect(items.find((i) => i.key === "toggleExpand")?.label).toBe("展开文件列表");
  });

  it("disables move when no other projects", () => {
    const items = buildProjectFileContextMenuItems({
      sourceProjectId: "a",
      projects: [{ id: "a", name: "Only", updated_at_ms: 0 }],
    });
    const move = items.find((i) => i.key === "move");
    expect(move?.disabled).toBe(true);
    expect(move?.children).toBeUndefined();
    const copy = items.find((i) => i.key === "copy");
    expect(copy?.disabled).toBe(false);
    expect(copy?.children?.map((c) => c.key)).toEqual(["copy:a"]);
  });

  it("lists other projects under move and all under copy", () => {
    const items = buildProjectFileContextMenuItems({
      sourceProjectId: "a",
      projects: [
        { id: "a", name: "A", updated_at_ms: 0 },
        { id: "b", name: "B", updated_at_ms: 0 },
      ],
    });
    const move = items.find((i) => i.key === "move");
    expect(move?.disabled).toBe(false);
    expect(move?.children?.map((c) => c.key)).toEqual(["move:b"]);
    expect(parseMoveDestProjectId("move:b")).toBe("b");
    expect(parseCopyDestProjectId("copy:a")).toBe("a");
    const copy = items.find((i) => i.key === "copy");
    expect(copy?.children?.map((c) => c.key)).toEqual(["copy:a", "copy:b"]);
  });
});
