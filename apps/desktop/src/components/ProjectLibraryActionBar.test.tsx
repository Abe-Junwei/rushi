import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { ProjectLibraryActionBar } from "./ProjectLibraryActionBar";

afterEach(() => {
  cleanup();
});

function mockController(overrides: Partial<ProjectControllerApi> = {}): ProjectControllerApi {
  return {
    busy: false,
    current: { id: "p1" },
    canStartBatchTranscribe: true,
    batchTranscribableCount: 2,
    loadProject: vi.fn().mockResolvedValue(undefined),
    pickAndImportAudioPathsToProject: vi.fn().mockResolvedValue({ imported: 1, skipped: 0 }),
    pickAndImportFileToProject: vi.fn().mockResolvedValue(true),
    startBatchTranscribe: vi.fn().mockResolvedValue(undefined),
    openProjectMetadataDialog: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  } as unknown as ProjectControllerApi;
}

describe("ProjectLibraryActionBar", () => {
  it("renders hub-migrated action buttons", () => {
    render(<ProjectLibraryActionBar controller={mockController()} projectId="p1" busy={false} />);
    expect(screen.getByRole("button", { name: "导入音频" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导入转录文本" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "批量转写 (2)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "项目信息" })).toBeNull();
  });

  it("runs batch for current project without reload", async () => {
    const startBatch = vi.fn().mockResolvedValue(undefined);
    const loadProject = vi.fn();
    render(
      <ProjectLibraryActionBar
        controller={mockController({ startBatchTranscribe: startBatch, loadProject })}
        projectId="p1"
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "批量转写 (2)" }));
    await waitFor(() => {
      expect(startBatch).toHaveBeenCalled();
    });
    expect(loadProject).not.toHaveBeenCalled();
  });
});
