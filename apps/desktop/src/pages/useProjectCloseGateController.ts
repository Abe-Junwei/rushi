import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRef, useState } from "react";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { writeLastWorkspace, type WorkspaceFileTarget } from "../services/lastWorkspace";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import type { BusyReason } from "./ProjectLifecycleApi";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";
import {
  decideLoadProject,
  decideOpenFile,
} from "./closeGateDecision";
import { createCloseGateNavigateHandlers } from "./closeGateNavigate";
import { createCloseGateProjectLoadActions } from "./closeGateProjectLoad";
import { useAppWindowCloseGuardEffect } from "./useAppWindowCloseGuardEffect";

type Proceed = () => void | Promise<void>;

type UseProjectCloseGateControllerArgs = {
  applyDetail: (detail: ProjectDetail) => void;
  beginBusy: (reason: BusyReason) => void;
  busy: boolean;
  busyReason: BusyReason | null;
  cancelTranscribe: () => void | Promise<void>;
  cancelBatchTranscribe?: () => Promise<void>;
  closeFile: () => void;
  current: ProjectDetail | null;
  currentFileId: string | null;
  dirty: SegmentDirtyStateApi;
  endBusy: () => void;
  openFile: (fileId: string) => Promise<SegmentDto[] | null>;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setTranscribeHints: React.Dispatch<React.SetStateAction<string[]>>;
  onClearTranscribeSession?: () => void;
  resetMutationHistory: () => void;
  projects: ProjectSummary[];
};

export type ProjectCloseGateControllerApi = {
  closeFileWrapped: () => void;
  closeGateIntent: "app-quit" | "navigate";
  closeGateOpen: boolean;
  closeProjectWrapped: () => void;
  discardUnsavedAndClose: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  loadProjectAfterImport: (id: string, preferFileId?: string | null) => Promise<void>;
  runWithUnsavedNavigateGate: (
    onProceed: () => void | Promise<void>,
  ) => Promise<boolean>;
  refreshProjectHub: (id: string) => Promise<void>;
  openFileWrapped: (fileId: string) => Promise<void>;
  openLastEditorWorkspace: () => Promise<void>;
  openWorkspaceFile: (projectId: string, fileId: string) => Promise<void>;
  openingWorkspaceTarget: WorkspaceFileTarget | null;
  saveAndClose: () => Promise<void>;
  stayAfterCloseAttempt: () => void;
  transcribeNavBlockOpen: boolean;
  transcribeNavBlockStopping: boolean;
  cancelTranscribeNavBlock: () => void;
  confirmTranscribeNavBlock: () => Promise<void>;
};

export function useProjectCloseGateController(
  args: UseProjectCloseGateControllerArgs,
): ProjectCloseGateControllerApi {
  const {
    applyDetail,
    beginBusy,
    busy,
    busyReason,
    cancelTranscribe,
    cancelBatchTranscribe,
    closeFile,
    current,
    currentFileId,
    dirty,
    endBusy,
    openFile,
    saveSegments,
    setCurrent,
    setError,
    setTranscribeHints,
    onClearTranscribeSession,
    resetMutationHistory,
    projects,
  } = args;

  const clearTranscribeSession = () => {
    setTranscribeHints([]);
    onClearTranscribeSession?.();
  };

  const closeAfterSaveRef = useRef(false);
  const navigateProceedRef = useRef<Proceed | null>(null);
  const unsavedGateAbortRef = useRef<(() => void) | null>(null);
  const bridgeStateRef = useRef({
    busy,
    busyReason,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
  });
  bridgeStateRef.current = {
    busy,
    busyReason,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
  };
  const [closeGateOpen, setCloseGateOpen] = useState(false);
  const [closeGateIntent, setCloseGateIntent] = useState<"app-quit" | "navigate">("app-quit");
  const [transcribeNavBlockOpen, setTranscribeNavBlockOpen] = useState(false);
  const [transcribeNavBlockStopping, setTranscribeNavBlockStopping] = useState(false);
  const [openingWorkspaceTarget, setOpeningWorkspaceTarget] =
    useState<WorkspaceFileTarget | null>(null);

  const navigateState = {
    setCloseGateOpen,
    setCloseGateIntent,
    setTranscribeNavBlockOpen,
    navigateProceedRef,
  };
  const navigateCtx = { busy, busyReason, dirty };
  const navigate = createCloseGateNavigateHandlers(navigateState, navigateCtx);

  function performCloseFile() {
    closeFile();
    dirty.clearSavedSnapshot();
    resetMutationHistory();
  }

  function runLeaveProject() {
    setCurrent(null);
    performCloseFile();
    clearTranscribeSession();
  }

  const openFileWrappedRef = useRef<(fileId: string) => Promise<void>>(async () => {});
  const openFileAfterImportRef = useRef<(fileId: string) => Promise<void>>(async () => {});

  const commitOpenedFile = (loaded: SegmentDto[] | null, openedFileId: string) => {
    if (!loaded) return;
    dirty.setSavedSnapshot(loaded);
    if (current?.id) {
      writeLastWorkspace({ projectId: current.id, fileId: openedFileId });
    }
  };

  const projectLoad = createCloseGateProjectLoadActions({
    applyDetail,
    beginBusy,
    endBusy,
    setError,
    setCurrent,
    current,
    currentFileId,
    dirty,
    performCloseFile,
    openFileWrapped: (fileId) => openFileWrappedRef.current(fileId),
    openFileAfterImport: (fileId) => openFileAfterImportRef.current(fileId),
    setOpeningWorkspaceTarget,
    projects,
  });

  async function openFileWrapped(fileId: string) {
    const performOpen = async () => {
      commitOpenedFile(await openFile(fileId), fileId);
    };

    const openDecision = decideOpenFile({
      currentFileId,
      targetFileId: fileId,
      hasUnsaved: dirty.hasUnsavedSegmentChanges(),
    });
    if (openDecision.kind === "open-guarded") {
      navigate.requestNavigateWithGuards(performOpen);
      return;
    }
    if (openDecision.kind === "noop-same-file-dirty") {
      return;
    }
    await performOpen();
  }
  openFileWrappedRef.current = openFileWrapped;

  async function openFileAfterImport(fileId: string) {
    commitOpenedFile(await openFile(fileId), fileId);
  }
  openFileAfterImportRef.current = openFileAfterImport;

  function closeFileWrapped() {
    navigate.requestNavigateWithGuards(performCloseFile);
  }

  async function confirmTranscribeNavBlock() {
    const proceed = navigateProceedRef.current;
    setTranscribeNavBlockStopping(true);
    try {
      setTranscribeNavBlockOpen(false);
      navigateProceedRef.current = null;
      if (!proceed) return;
      if (busyReason === "batch_transcribe" && cancelBatchTranscribe) {
        await cancelBatchTranscribe();
      } else {
        await cancelTranscribe();
      }
      navigate.requestNavigateWithUnsavedCheck(proceed);
    } finally {
      setTranscribeNavBlockStopping(false);
    }
  }

  function openLastEditorWorkspace(): Promise<void> {
    if (busy) return Promise.resolve();
    navigate.requestNavigateWithGuards(() => projectLoad.performResumeEditorWorkspace());
    return Promise.resolve();
  }

  function openWorkspaceFile(projectId: string, fileId: string) {
    if (busy) return;
    navigate.requestNavigateWithGuards(() =>
      projectLoad.performOpenWorkspaceFile(projectId, fileId),
    );
  }

  async function loadProject(id: string) {
    if (busy) return;
    const loadDecision = decideLoadProject({
      currentProjectId: current?.id ?? null,
      targetProjectId: id,
      hasUnsaved: dirty.hasUnsavedSegmentChanges(),
      currentFileId,
    });
    if (loadDecision.kind === "load-guarded") {
      navigate.requestNavigateWithGuards(() => projectLoad.performLoadProject(id));
      return;
    }
    await projectLoad.performLoadProject(id);
  }

  async function requestAppClose() {
    closeAfterSaveRef.current = true;
    setCloseGateOpen(false);
    navigateProceedRef.current = null;
    try {
      await getCurrentWindow().destroy();
    } catch (e) {
      closeAfterSaveRef.current = false;
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stayAfterCloseAttempt() {
    unsavedGateAbortRef.current?.();
    unsavedGateAbortRef.current = null;
    setCloseGateOpen(false);
    navigateProceedRef.current = null;
  }

  function runWithUnsavedNavigateGate(onProceed: Proceed): Promise<boolean> {
    if (!dirty.hasUnsavedSegmentChanges()) {
      return Promise.resolve(onProceed()).then(() => true);
    }
    return new Promise((resolve) => {
      unsavedGateAbortRef.current = () => resolve(false);
      navigate.openUnsavedNavigateGate(async () => {
        unsavedGateAbortRef.current = null;
        await onProceed();
        resolve(true);
      });
    });
  }

  async function finishNavigateAfterDiscard() {
    segmentDraftStore.resetAll();
    setCloseGateOpen(false);
    const proceed = navigateProceedRef.current;
    navigateProceedRef.current = null;
    await proceed?.();
  }

  async function discardUnsavedAndClose() {
    if (closeGateIntent === "navigate") {
      await finishNavigateAfterDiscard();
      return;
    }
    segmentDraftStore.resetAll();
    await requestAppClose();
  }

  async function saveAndClose() {
    const saved = await saveSegments();
    if (!saved) {
      setError("保存失败，请修正后重试或放弃修改。");
      if (closeGateIntent === "navigate") {
        unsavedGateAbortRef.current?.();
        unsavedGateAbortRef.current = null;
        setCloseGateOpen(false);
        navigateProceedRef.current = null;
      }
      return;
    }
    if (closeGateIntent === "navigate") {
      setCloseGateOpen(false);
      const proceed = navigateProceedRef.current;
      navigateProceedRef.current = null;
      await proceed?.();
      return;
    }
    await requestAppClose();
  }

  useAppWindowCloseGuardEffect({
    bridgeStateRef,
    closeAfterSaveRef,
    onBlockedTranscribe: () => navigate.openTranscribeNavBlock(() => requestAppClose()),
    onBlockedUnsaved: () => {
      navigateProceedRef.current = null;
      setCloseGateIntent("app-quit");
      setCloseGateOpen(true);
    },
  });

  return {
    closeFileWrapped,
    closeGateIntent,
    closeGateOpen,
    closeProjectWrapped: () => navigate.requestNavigateWithGuards(runLeaveProject),
    discardUnsavedAndClose,
    loadProject,
    loadProjectAfterImport: projectLoad.loadProjectAfterImport,
    refreshProjectHub: projectLoad.refreshProjectHub,
    runWithUnsavedNavigateGate,
    openFileWrapped,
    openLastEditorWorkspace,
    openWorkspaceFile,
    openingWorkspaceTarget,
    saveAndClose,
    stayAfterCloseAttempt,
    transcribeNavBlockOpen,
    transcribeNavBlockStopping,
    cancelTranscribeNavBlock: navigate.cancelTranscribeNavBlock,
    confirmTranscribeNavBlock,
  };
}
