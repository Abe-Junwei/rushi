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
  openFileWrapped: (fileId: string) => Promise<void>;
  openLastEditorWorkspace: () => Promise<void>;
  saveAndClose: () => Promise<void>;
  stayAfterCloseAttempt: () => void;
};

export function useProjectCloseGateController(
  args: UseProjectCloseGateControllerArgs,
): ProjectCloseGateControllerApi {
  const {
    applyDetail,
    beginBusy,
    busy,
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
    resetMutationHistory,
    projects,
  } = args;

  const closeAfterSaveRef = useRef(false);
  const navigateProceedRef = useRef<Proceed | null>(null);
  const [closeGateOpen, setCloseGateOpen] = useState(false);
  const [closeGateIntent, setCloseGateIntent] = useState<"app-quit" | "navigate">("app-quit");

  function closeFileWrapped() {
    closeFile();
    dirty.clearSavedSnapshot();
    resetMutationHistory();
  }

  function runLeaveProject() {
    setCurrent(null);
    closeFileWrapped();
    setTranscribeHints([]);
  }

  function openUnsavedNavigateGate(onProceed: Proceed) {
    navigateProceedRef.current = onProceed;
    setCloseGateIntent("navigate");
    setCloseGateOpen(true);
  }

  function requestNavigateWithUnsavedCheck(onProceed: Proceed) {
    if (!dirty.hasUnsavedSegmentChanges()) {
      void onProceed();
      return;
    }
    openUnsavedNavigateGate(onProceed);
  }

  async function openFileWrapped(fileId: string) {
    const afterOpen = (loaded: SegmentDto[] | null, openedFileId: string) => {
      if (!loaded) return;
      dirty.setSavedSnapshot(loaded);
      if (current?.id) {
        writeLastWorkspace({ projectId: current.id, fileId: openedFileId });
      }
    };

    if (currentFileId && fileId !== currentFileId && dirty.hasUnsavedSegmentChanges()) {
      openUnsavedNavigateGate(async () => {
        afterOpen(await openFile(fileId), fileId);
      });
      return;
    }
    afterOpen(await openFile(fileId), fileId);
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

  async function openLastEditorWorkspace() {
    if (busy) return;
    if (dirty.hasUnsavedSegmentChanges()) {
      requestNavigateWithUnsavedCheck(() => performResumeEditorWorkspace());
      return;
    }
    await performResumeEditorWorkspace();
  }

  async function performLoadProject(id: string) {
    setError("");
    beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      applyDetail(detail);
      if (detail.files && detail.files.length > 0) {
        const sorted = [...detail.files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
        await openFileWrapped(sorted[0].id);
      } else {
        dirty.clearSavedSnapshot();
      }
    } catch (e) {
      setCurrent(null);
      closeFileWrapped();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }

  async function loadProject(id: string) {
    if (busy) return;
    if (current?.id !== id && dirty.hasUnsavedSegmentChanges()) {
      openUnsavedNavigateGate(() => performLoadProject(id));
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
      hasUnsaved: () => dirty.hasUnsavedSegmentChanges(),
      onBlocked: () => {
        navigateProceedRef.current = null;
        setCloseGateIntent("app-quit");
        setCloseGateOpen(true);
      },
      isClosingAfterSave: () => closeAfterSaveRef.current,
    });
    return () => setAppWindowCloseGuardBridge(null);
  }, [dirty.hasUnsavedSegmentChanges]);

  return {
    closeFileWrapped,
    closeGateIntent,
    closeGateOpen,
    closeProjectWrapped: () => requestNavigateWithUnsavedCheck(runLeaveProject),
    discardUnsavedAndClose,
    loadProject,
    openFileWrapped,
    openLastEditorWorkspace,
    saveAndClose,
    stayAfterCloseAttempt,
  };
}
