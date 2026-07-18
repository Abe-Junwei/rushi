import { describe, expect, it } from "vitest";
import { patchProjectFileSummary, patchProjectFilesList } from "./patchProjectFileSummary";
import type { ProjectDetail } from "../tauri/projectTypes";

const project = (files: ProjectDetail["files"]): ProjectDetail => ({
  id: "p1",
  name: "P",
  audio_storage_path: "",
  segments: [],
  files,
  created_at_ms: 1,
  updated_at_ms: 1,
});

describe("patchProjectFileSummary", () => {
  it("updates duration on matching file", () => {
    const prev = project([
      {
        id: "f1",
        name: "a",
        file_type: "paired",
        updated_at_ms: 1,
        duration_sec: null,
      },
    ]);
    const next = patchProjectFileSummary(prev, "f1", { duration_sec: 125 });
    expect(next?.files[0]?.duration_sec).toBe(125);
  });

  it("replaces files list", () => {
    const prev = project([]);
    const next = patchProjectFilesList(prev, [
      { id: "f2", name: "b", file_type: "audio_only", updated_at_ms: 2, duration_sec: 10 },
    ]);
    expect(next?.files).toHaveLength(1);
    expect(next?.files[0]?.duration_sec).toBe(10);
  });
});
