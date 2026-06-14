import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fileApi from "../tauri/fileApi";
import {
  LAST_WORKSPACE_STORAGE_KEY,
  hasScannableWorkspaceFiles,
  readLastWorkspace,
  recentProjectIdsForScan,
  resolveEditorResumeTarget,
  writeLastWorkspace,
} from "./lastWorkspace";

vi.mock("../tauri/fileApi", () => ({
  listFiles: vi.fn(),
}));

describe("lastWorkspace", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
    vi.mocked(fileApi.listFiles).mockReset();
  });

  it("read/write round-trip", () => {
    writeLastWorkspace({ projectId: "p1", fileId: "f1" });
    expect(readLastWorkspace()).toEqual({ projectId: "p1", fileId: "f1" });
  });

  it("recentProjectIdsForScan sorts by project updated_at", () => {
    const ids = recentProjectIdsForScan([
      { id: "a", name: "A", updated_at_ms: 100 },
      { id: "b", name: "B", updated_at_ms: 300 },
      { id: "c", name: "C", updated_at_ms: 200 },
    ]);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("hasScannableWorkspaceFiles is false when every scanned project has file_count 0", () => {
    expect(
      hasScannableWorkspaceFiles([
        { id: "a", name: "A", updated_at_ms: 100, file_count: 0 },
        { id: "b", name: "B", updated_at_ms: 200, file_count: 0 },
      ]),
    ).toBe(false);
    expect(hasScannableWorkspaceFiles([])).toBe(false);
  });

  it("hasScannableWorkspaceFiles is true when a scanned project has files", () => {
    expect(
      hasScannableWorkspaceFiles([
        { id: "a", name: "A", updated_at_ms: 100, file_count: 0 },
        { id: "b", name: "B", updated_at_ms: 200, file_count: 2 },
      ]),
    ).toBe(true);
  });

  it("resolveEditorResumeTarget prefers stored file when it still exists", async () => {
    window.localStorage.setItem(
      LAST_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ projectId: "p-old", fileId: "f-old" }),
    );
    vi.mocked(fileApi.listFiles).mockImplementation((projectId) => {
      if (projectId === "p-old") {
        return Promise.resolve([
          {
            id: "f-old",
            name: "old",
            file_type: "text",
            updated_at_ms: 50,
          },
        ]);
      }
      return Promise.resolve([
        {
          id: "f-new",
          name: "new",
          file_type: "text",
          updated_at_ms: 999,
        },
      ]);
    });

    const target = await resolveEditorResumeTarget([
      { id: "p-old", name: "Old", updated_at_ms: 1 },
      { id: "p-new", name: "New", updated_at_ms: 2 },
    ]);

    expect(target).toEqual({ projectId: "p-old", fileId: "f-old" });
    expect(fileApi.listFiles).toHaveBeenCalledWith("p-old");
  });
});
