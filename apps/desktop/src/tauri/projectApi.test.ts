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
      requestId: null,
    });
  });
});

describe("projectCancelTranscribe", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(true);
  });

  it("invokes project_cancel_transcribe with camelCase requestId", async () => {
    const { projectCancelTranscribe } = await import("./projectApi");
    await projectCancelTranscribe("online-stt-123");
    expect(invokeMock).toHaveBeenCalledWith("project_cancel_transcribe", {
      requestId: "online-stt-123",
    });
  });
});

describe("updateProjectMetadata", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      id: "proj-1",
      name: "场次",
      files: [],
      created_at_ms: 0,
      updated_at_ms: 1,
      recorded_at: "2024-03",
    });
  });

  it("passes recordedAt in camelCase for Tauri IPC", async () => {
    const { updateProjectMetadata } = await import("./projectApi");
    await updateProjectMetadata("proj-1", {
      narrator: "张三",
      recorded_at: "2024-03",
      location: "北京",
    });
    expect(invokeMock).toHaveBeenCalledWith("update_project_metadata", {
      projectId: "proj-1",
      narrator: "张三",
      recordedAt: "2024-03",
      location: "北京",
      subject: null,
      transcriber: null,
    });
  });
});
