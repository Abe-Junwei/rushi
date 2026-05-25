import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args) as Promise<unknown>,
}));

describe("projectRunTranscribe", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      detail: {
        id: "file-1",
        project_id: "proj-1",
        name: "a.wav",
        file_type: "paired",
        audio_path: "/tmp/a.wav",
        segments: [],
        created_at_ms: 0,
        updated_at_ms: 0,
      },
      engine: "stub",
      warnings: [],
    });
  });

  it("invokes project_run_transcribe with fileId (not projectId)", async () => {
    const { projectRunTranscribe } = await import("./projectApi");
    await projectRunTranscribe("file-abc", "http://127.0.0.1:8741", null);
    expect(invokeMock).toHaveBeenCalledWith("project_run_transcribe", {
      fileId: "file-abc",
      asrBaseUrl: "http://127.0.0.1:8741",
      online: null,
    });
  });
});
