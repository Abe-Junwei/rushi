import { describe, expect, it } from "vitest";
import { resolveWorkspaceShellVariant } from "./resolveWorkspaceShellVariant";

describe("resolveWorkspaceShellVariant", () => {
  it("returns welcome when no project is loaded", () => {
    expect(
      resolveWorkspaceShellVariant({
        hasCurrentProject: false,
        currentFileId: null,
        openingWorkspaceTarget: null,
      }),
    ).toBe("welcome");
  });

  it("returns hub when project is loaded without a file", () => {
    expect(
      resolveWorkspaceShellVariant({
        hasCurrentProject: true,
        currentFileId: null,
        openingWorkspaceTarget: null,
      }),
    ).toBe("hub");
  });

  it("returns editor when a file is open", () => {
    expect(
      resolveWorkspaceShellVariant({
        hasCurrentProject: true,
        currentFileId: "file-1",
        openingWorkspaceTarget: null,
      }),
    ).toBe("editor");
  });

  it("returns editor while opening a workspace file before currentFileId is set", () => {
    expect(
      resolveWorkspaceShellVariant({
        hasCurrentProject: false,
        currentFileId: null,
        openingWorkspaceTarget: { projectId: "p1", fileId: "f1" },
      }),
    ).toBe("editor");
  });

  it("returns editor while opening a file on hub without flashing hub", () => {
    expect(
      resolveWorkspaceShellVariant({
        hasCurrentProject: true,
        currentFileId: null,
        openingWorkspaceTarget: { projectId: "p1", fileId: "f1" },
      }),
    ).toBe("editor");
  });
});
