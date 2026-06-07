import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import {
  ensureAppWindowCloseGuardRegistered,
  setAppWindowCloseGuardBridge,
} from "../services/appWindowCloseGuard";
import { resolveEditorResumeTarget, writeLastWorkspace } from "../services/lastWorkspace";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { BusyReason } from "./ProjectLifecycleApi";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";

type Proceed = () => void | Promise<void>;

type UseProjectCloseGateControllerArgs = {
  applyDetail: (detail: ProjectDetail) => void;
  beginBusy: (reason: BusyReason) => void;
  busy: boolean;
  busyReason: BusyReason | null;
  cancelTranscribe: () => void | Promise<void>;
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
  loadProjectAfterImport: (id: string) => Promise<void>;
  refreshProjectHub: (id: string) => Promise<void>;
  openFileWrapped: (fileId: string) => Promise<void>;
  openLastEditorWorkspace: () => Promise<void>;
  saveAndClose: () => Promise<void>;
  stayAfterCloseAttempt: () => void;
  transcribeNavBlockOpen: boolean;
  cancelTranscribeNavBlock: () => void;
  confirmTranscribeNavBlock: () => Promise<void>;
};

function isTranscribeBusy(busy: boolean, busyReason: BusyReason | null): boolean {
  return busy && busyReason === "transcribe";
}

export function useProjectCloseGateController(
  args: UseProjectCloseGateControllerArgs,
): ProjectCloseGateControllerApi {
  const {
    applyDetail,
    beginBusy,
    busy,
    busyReason,
    cancelTranscribe,
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

  function openUnsavedNavigateGate(onProceed: Proceed) {
    navigateProceedRef.current = onProceed;
    setCloseGateIntent("navigate");
    setCloseGateOpen(true);
  }

  function openTranscribeNavBlock(onProceed: Proceed) {
    navigateProceedRef.current = onProceed;
    setTranscribeNavBlockOpen(true);
  }

  function requestNavigateWithUnsavedCheck(onProceed: Proceed) {
    if (!dirty.hasUnsavedSegmentChanges()) {
      void onProceed();
      return;
    }
    openUnsavedNavigateGate(onProceed);
  }

  function requestNavigateWithGuards(onProceed: Proceed) {
    if (isTranscribeBusy(busy, busyReason)) {
      openTranscribeNavBlock(onProceed);
      return;
    }
    requestNavigateWithUnsavedCheck(onProceed);
  }

  function closeFileWrapped() {
    requestNavigateWithGuards(performCloseFile);
  }

  function cancelTranscribeNavBlock() {
    setTranscribeNavBlockOpen(false);
    navigateProceedRef.current = null;
  }

  async function confirmTranscribeNavBlock() {
    const proceed = navigateProceedRef.current;
    setTranscribeNavBlockOpen(false);
    navigateProceedRef.current = null;
    if (!proceed) return;
    await cancelTranscribe();
    requestNavigateWithUnsavedCheck(proceed);
  }

  async function openFileWrapped(fileId: string) {
    const afterOpen = (loaded: SegmentDto[] | null, openedFileId: string) => {
      if (!loaded) return;
      dirty.setSavedSnapshot(loaded);
      if (current?.id) {
        writeLastWorkspace({ projectId: current.id, fileId: openedFileId });
      }
    };

    const performOpen = async () => {
      afterOpen(await openFile(fileId), fileId);
    };

    if (currentFileId && fileId !== currentFileId) {
      requestNavigateWithGuards(performOpen);
      return;
    }
    if (currentFileId === fileId && dirty.hasUnsavedSegmentChanges()) {
      return;
    }
    await performOpen();
  }

  async function performResumeEditorWorkspace() {
    const target = await resolveEditorResumeTarget(projects);
    if (!target) {
      setError("暂无项目或文件，请先新建项目。");
      return;
    }
    beginBusy("load");
    setError("");
    try {
      if (current?.id !== target.projectId) {
        const detail = await p1.projectLoad(target.projectId);
        applyDetail(detail);
      }
      await openFileWrapped(target.fileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }

  function openLastEditorWorkspace(): Promise<void> {
    if (busy) return Promise.resolve();
    requestNavigateWithGuards(() => performResumeEditorWorkspace());
    return Promise.resolve();
  }

  async function performLoadProject(id: string) {
    setError("");
    beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      const sameProject = current?.id === id;
      const fileStillExists =
        currentFileId != null && detail.files?.some((f) => f.id === currentFileId);

      if (sameProject && dirty.hasUnsavedSegmentChanges() && currentFileId && fileStillExists) {
        applyDetail(detail);
        return;
      }

      if (!sameProject || currentFileId) {
        performCloseFile();
      }

      applyDetail(detail);

      if (!detail.files?.length) {
        dirty.clearSavedSnapshot();
      }
    } catch (e) {
      setCurrent(null);
      performCloseFile();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }

  async function loadProjectAfterImport(id: string) {
    setError("");
    beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      applyDetail(detail);

      if (!detail.files?.length) {
        if (currentFileId) {
          performCloseFile();
        } else {
          dirty.clearSavedSnapshot();
        }
        return;
      }

      const sorted = [...detail.files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
      await openFileWrapped(sorted[0].id);
    } catch (e) {
      setCurrent(null);
      performCloseFile();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }

  async function refreshProjectHub(id: string) {
    if (busy) return;
    setError("");
    beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      applyDetail(detail);
      if (!detail.files?.length) {
        dirty.clearSavedSnapshot();
      }
    } catch (e) {
      setCurrent(null);
      performCloseFile();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }

  async function loadProject(id: string) {
    if (busy) return;
    if (current?.id !== id) {
      requestNavigateWithGuards(() => performLoadProject(id));
      return;
    }
    if (dirty.hasUnsavedSegmentChanges() && currentFileId) {
      await performLoadProject(id);
      return;
    }
    await performLoadProject(id);
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
    setCloseGateOpen(false);
    navigateProceedRef.current = null;
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
    if (!saved) return;
    if (closeGateIntent === "navigate") {
      setCloseGateOpen(false);
      const proceed = navigateProceedRef.current;
      navigateProceedRef.current = null;
      await proceed?.();
      return;
    }
    await requestAppClose();
  }

  useEffect(() => {
    ensureAppWindowCloseGuardRegistered();
    setAppWindowCloseGuardBridge({
      shouldBlockClose: () => {
        const s = bridgeStateRef.current;
        return (
          s.hasUnsavedSegmentChanges() || isTranscribeBusy(s.busy, s.busyReason)
        );
      },
      onBlocked: () => {
        const s = bridgeStateRef.current;
        if (isTranscribeBusy(s.busy, s.busyReason)) {
          openTranscribeNavBlock(() => requestAppClose());
          return;
        }
        navigateProceedRef.current = null;
        setCloseGateIntent("app-quit");
        setCloseGateOpen(true);
      },
      isClosingAfterSave: () => closeAfterSaveRef.current,
    });
    return () => setAppWindowCloseGuardBridge(null);
  }, []);

  return {
    closeFileWrapped,
    closeGateIntent,
    closeGateOpen,
    closeProjectWrapped: () => requestNavigateWithGuards(runLeaveProject),
    discardUnsavedAndClose,
    loadProject,
    loadProjectAfterImport,
    refreshProjectHub,
    openFileWrapped,
    openLastEditorWorkspace,
    saveAndClose,
    stayAfterCloseAttempt,
    transcribeNavBlockOpen,
    cancelTranscribeNavBlock,
    confirmTranscribeNavBlock,
  };
}
