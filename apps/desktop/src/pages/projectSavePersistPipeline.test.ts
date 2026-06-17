import { describe, expect, it, vi } from "vitest";
import { runProjectSavePersistPipeline } from "./projectSavePersistPipeline";
import { createSegmentPublishApi } from "./segmentPublishApi";
import type { FileDetail, ProjectDetail, SegmentDto } from "../tauri/projectApi";

const mocks = vi.hoisted(() => ({
  fileSaveSegments: vi.fn(),
  loadFile: vi.fn(),
  projectLoad: vi.fn(),
}));

vi.mock("../tauri/fileApi", () => ({
  fileSaveSegments: mocks.fileSaveSegments,
  loadFile: mocks.loadFile,
}));

vi.mock("../tauri/projectApi", () => ({
  projectLoad: mocks.projectLoad,
}));

function seg(uid: string, text: string, idx = 0): SegmentDto {
  return {
    uid,
    idx,
    start_sec: idx,
    end_sec: idx + 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
}

function project(): ProjectDetail {
  return {
    id: "p1",
    name: "Project",
    audio_storage_path: "",
    created_at_ms: 1,
    updated_at_ms: 2,
    segments: [],
    files: [],
  };
}

function fileDetail(segments: SegmentDto[]): FileDetail {
  return {
    id: "f1",
    project_id: "p1",
    name: "File",
    file_type: "audio",
    audio_path: null,
    segments,
    created_at_ms: 1,
    updated_at_ms: 2,
  };
}

describe("runProjectSavePersistPipeline", () => {
  it("persists segmentPublish snapshot (ref) as save source", async () => {
    const current = project();
    const latest = [seg("s1", "latest")];
    const segmentsRef = { current: latest };
    const selectedIdxRef = { current: 0 };
    const setCurrent = vi.fn();
    const setSelectedIdx = vi.fn();
    const setSegments = vi.fn((updater: SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[])) => {
      segmentsRef.current =
        typeof updater === "function" ? updater(segmentsRef.current) : updater;
    });
    const segmentPublish = createSegmentPublishApi(segmentsRef, setSegments);

    mocks.projectLoad.mockResolvedValue(current);
    mocks.loadFile.mockResolvedValue(fileDetail(latest));

    const outcome = await runProjectSavePersistPipeline({
      current,
      currentFileId: "f1",
      segmentPublish,
      selectedIdxRef,
      savedSnapshot: latest,
      pendingAiRevisedUids: new Set(),
      setCurrent,
      setSelectedIdx,
    });

    expect(mocks.fileSaveSegments).toHaveBeenCalledWith(
      "f1",
      [expect.objectContaining({ text: "latest" })],
      expect.objectContaining({ countHits: true }),
    );
    expect(outcome.snapshotBase[0]?.text).toBe("latest");
    expect(setSelectedIdx).not.toHaveBeenCalled();
  });
});
