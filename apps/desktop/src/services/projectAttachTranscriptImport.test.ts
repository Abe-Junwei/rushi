import { describe, expect, it, vi } from "vitest";
import { resolveTranscriptImport } from "./projectAttachTranscriptImport";

vi.mock("../tauri/fileApi", () => ({
  importTranscriptToProject: vi.fn(),
}));

import * as fileApi from "../tauri/fileApi";

describe("resolveTranscriptImport", () => {
  it("prompts for attach target when hub stem is ambiguous", async () => {
    vi.mocked(fileApi.importTranscriptToProject)
      .mockResolvedValueOnce({
        outcome: "need_target",
        candidates: [
          { id: "a1", name: "采访", file_type: "paired", updated_at_ms: 1 },
          { id: "a2", name: "采访", file_type: "paired", updated_at_ms: 2 },
        ],
        transcript_stem: "采访",
      })
      .mockResolvedValueOnce({
        outcome: "attached",
        project: {
          id: "proj-1",
          name: "Project",
          files: [],
          created_at_ms: 1,
          updated_at_ms: 1,
        },
        file_id: "a2",
      });

    const askAttachImportTarget = vi.fn(() => Promise.resolve("a2" as const));
    const result = await resolveTranscriptImport(
      "proj-1",
      "/tmp/采访.srt",
      askAttachImportTarget,
    );

    expect(result).toEqual({ ok: true, fileId: "a2" });
    expect(askAttachImportTarget).toHaveBeenCalledTimes(1);
    expect(fileApi.importTranscriptToProject).toHaveBeenNthCalledWith(
      2,
      "proj-1",
      "/tmp/采访.srt",
      "a2",
    );
  });
});
