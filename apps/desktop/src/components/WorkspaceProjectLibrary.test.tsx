import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";
import { WorkspaceProjectLibrary } from "./WorkspaceProjectLibrary";

afterEach(() => {
  cleanup();
});

const projects: ProjectSummary[] = [
  { id: "p1", name: "项目甲", updated_at_ms: 200, file_count: 1 },
  { id: "p2", name: "项目乙", updated_at_ms: 100, file_count: 0 },
];

function mockController(overrides: Partial<ProjectControllerApi> = {}): ProjectControllerApi {
  return {
    busy: false,
    current: null,
    isRenamingProject: false,
    renamingProjectId: null,
    renameProjectDraft: "",
    renamingProjectFileId: null,
    renameProjectFileDraft: "",
    canStartBatchTranscribe: false,
    batchTranscribableCount: 0,
    beginRenameProject: vi.fn(),
    requestDeleteProject: vi.fn(),
    revealProjectLocation: vi.fn(),
    revealFileLocation: vi.fn(),
    beginRenameProjectFile: vi.fn(),
    requestDeleteProjectFile: vi.fn(),
    requestMoveProjectFile: vi.fn(),
    requestCopyProjectFile: vi.fn(),
    moveProjectFileNow: vi.fn(),
    commitRenameProject: vi.fn(),
    cancelRenameProject: vi.fn(),
    setRenameProjectDraft: vi.fn(),
    commitRenameProjectFile: vi.fn(),
    cancelRenameProjectFile: vi.fn(),
    setRenameProjectFileDraft: vi.fn(),
    loadProject: vi.fn(),
    pickAndImportAudioPathsToProject: vi.fn(),
    pickAndImportFileToProject: vi.fn(),
    startBatchTranscribe: vi.fn(),
    openProjectMetadataDialog: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  } as unknown as ProjectControllerApi;
}

describe("WorkspaceProjectLibrary", () => {
  it("toggles expand on project row click without loadProject", () => {
    const loadProject = vi.fn();
    const onToggle = vi.fn();
    render(
      <WorkspaceProjectLibrary
        controller={mockController({ loadProject })}
        projects={projects}
        sortMode="updated"
        expandedProjectId={null}
        projectFilesById={{}}
        loadingFilesById={{}}
        onOpenProjectFile={vi.fn()}
        onToggleProjectExpanded={onToggle}
      />,
    );
    fireEvent.click(screen.getByTitle("展开：项目甲"));
    expect(onToggle).toHaveBeenCalledWith("p1", false);
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("shows action bar when expanded", () => {
    render(
      <WorkspaceProjectLibrary
        controller={mockController()}
        projects={projects}
        sortMode="updated"
        expandedProjectId="p1"
        projectFilesById={{ p1: [] }}
        loadingFilesById={{}}
        onOpenProjectFile={vi.fn()}
        onToggleProjectExpanded={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "导入音频" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导入转录文本" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /批量转写/ })).toBeTruthy();
  });

  it("shows project info and delete on each project row", () => {
    const requestDelete = vi.fn();
    const openMeta = vi.fn();
    const loadProject = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspaceProjectLibrary
        controller={mockController({
          requestDeleteProject: requestDelete,
          openProjectMetadataDialog: openMeta,
          loadProject,
          current: null,
        })}
        projects={projects}
        sortMode="updated"
        expandedProjectId={null}
        projectFilesById={{}}
        loadingFilesById={{}}
        onOpenProjectFile={vi.fn()}
        onToggleProjectExpanded={vi.fn()}
      />,
    );
    const infoButtons = screen.getAllByRole("button", { name: "项目信息" });
    const deleteButtons = screen.getAllByRole("button", { name: "删除项目" });
    expect(infoButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);
    expect(requestDelete).toHaveBeenCalledWith("p1", "项目甲");
  });

  it("opens project context menu with import and metadata actions", () => {
    const openMeta = vi.fn();
    const loadProject = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <WorkspaceProjectLibrary
        controller={mockController({
          openProjectMetadataDialog: openMeta,
          loadProject,
          current: null,
        })}
        projects={projects}
        sortMode="updated"
        expandedProjectId={null}
        projectFilesById={{}}
        loadingFilesById={{}}
        onOpenProjectFile={vi.fn()}
        onToggleProjectExpanded={vi.fn()}
      />,
    );
    const row = container.querySelector('[data-library-project-id="p1"]');
    expect(row).toBeTruthy();
    fireEvent.contextMenu(row!);
    fireEvent.click(screen.getByRole("menuitem", { name: "项目信息" }));
    expect(loadProject).toHaveBeenCalledWith("p1");
  });

  it("renders the full project list without a pager", () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      id: `p${i}`,
      name: `项目${i}`,
      updated_at_ms: 1000 - i,
      file_count: 0,
    }));
    const { container } = render(
      <WorkspaceProjectLibrary
        controller={mockController()}
        projects={many}
        sortMode="updated"
        expandedProjectId={null}
        projectFilesById={{}}
        loadingFilesById={{}}
        onOpenProjectFile={vi.fn()}
        onToggleProjectExpanded={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("项目列表翻页")).toBeNull();
    expect(screen.queryByLabelText("项目文件翻页")).toBeNull();
    expect(container.querySelector("[data-purpose='project-library-pager']")).toBeNull();
    expect(container.querySelector("[data-purpose='workspace-project-library-scroll']")).toBeTruthy();
    expect(screen.getByTitle("展开：项目0")).toBeTruthy();
    expect(screen.getByTitle("展开：项目8")).toBeTruthy();
    expect(screen.getByTitle("展开：项目16")).toBeTruthy();
  });
});
