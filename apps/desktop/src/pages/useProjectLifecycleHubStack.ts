import type { ProjectDetail } from "../tauri/projectApi";
import { useProjectCrudController } from "./useProjectCrudController";
import { useProjectImportDuplicateController } from "./useProjectImportDuplicateController";
import { useProjectFileMutationController } from "./useProjectFileMutationController";
import { useProjectMutationController } from "./useProjectMutationController";
import type { ProjectCloseGateControllerApi } from "./useProjectCloseGateController";
import type { SegmentMutationApi } from "./useSegmentMutationController";
import type { BusyReason } from "./useProjectCrudController";

type UseProjectLifecycleHubStackArgs = {
  pickedPath: string | null;
  newName: string;
  current: ProjectDetail | null;
  currentFileId: string | null;
  busy: boolean;
  busyReason: BusyReason | null;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  setSegments: React.Dispatch<React.SetStateAction<import("../tauri/projectApi").SegmentDto[]>>;
  setAudioSrc: React.Dispatch<React.SetStateAction<string | null>>;
  applyDetail: (detail: ProjectDetail) => void;
  refreshProjects: () => Promise<void>;
  mutations: SegmentMutationApi;
  closeGate: ProjectCloseGateControllerApi;
  closeProject: () => void;
  setTranscribeHints: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useProjectLifecycleHubStack(args: UseProjectLifecycleHubStackArgs) {
  const importDuplicate = useProjectImportDuplicateController({
    currentProjectId: args.current?.id,
    currentFileId: args.currentFileId,
    projectFiles: args.current?.files,
    busy: args.busy,
    busyReason: args.busyReason,
    beginBusy: args.beginBusy,
    endBusy: args.endBusy,
    loadProjectAfterImport: args.closeGate.loadProjectAfterImport,
    openFile: args.closeGate.openFileWrapped,
    runWithUnsavedNavigateGate: args.closeGate.runWithUnsavedNavigateGate,
    setError: args.setError,
  });

  const fileMutation = useProjectFileMutationController({
    projectId: args.current?.id,
    busy: args.busy,
    refreshProjectHub: args.closeGate.refreshProjectHub,
    setError: args.setError,
  });

  const crud = useProjectCrudController({
    pickedPath: args.pickedPath,
    newName: args.newName,
    current: args.current,
    setError: args.setError,
    beginBusy: args.beginBusy,
    endBusy: args.endBusy,
    applyDetail: args.applyDetail,
    refreshProjects: args.refreshProjects,
    mutations: args.mutations,
    closeProject: args.closeProject,
    setTranscribeHints: args.setTranscribeHints,
  });

  const projectMutation = useProjectMutationController({
    current: args.current,
    busy: args.busy,
    refreshProjectHub: args.closeGate.refreshProjectHub,
    refreshProjects: args.refreshProjects,
    deleteProject: crud.deleteProject,
    setError: args.setError,
    setCurrent: args.setCurrent,
  });

  return { importDuplicate, fileMutation, crud, projectMutation };
}
