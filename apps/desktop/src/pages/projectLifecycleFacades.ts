import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
import type { ProjectCloseGateControllerApi } from "./useProjectCloseGateController";
import type { ExportApi } from "./useExportController";
import type { BusyReason } from "./useProjectCrudController";

/** Close Gate + Project Hub 导航 facade。 */
export type CloseGateLifecycleFacade = Pick<
  ProjectLifecycleApi,
  | "loadProject"
  | "loadProjectAfterImport"
  | "openFile"
  | "openLastEditorWorkspace"
  | "openWorkspaceFile"
  | "openingWorkspaceTarget"
  | "closeFile"
  | "closeProject"
  | "closeGateOpen"
  | "closeGateIntent"
  | "stayAfterCloseAttempt"
  | "discardUnsavedAndClose"
  | "saveAndClose"
  | "transcribeNavBlockOpen"
  | "transcribeNavBlockStopping"
  | "cancelTranscribeNavBlock"
  | "confirmTranscribeNavBlock"
  | "hasUnsavedFileEdits"
>;

export function pickCloseGateLifecycleFacade(
  closeGate: ProjectCloseGateControllerApi,
  hasUnsavedFileEdits: () => boolean,
): CloseGateLifecycleFacade {
  return {
    loadProject: closeGate.loadProject,
    loadProjectAfterImport: closeGate.loadProjectAfterImport,
    openFile: closeGate.openFileWrapped,
    openLastEditorWorkspace: closeGate.openLastEditorWorkspace,
    openWorkspaceFile: closeGate.openWorkspaceFile,
    openingWorkspaceTarget: closeGate.openingWorkspaceTarget,
    closeFile: closeGate.closeFileWrapped,
    closeProject: closeGate.closeProjectWrapped,
    closeGateOpen: closeGate.closeGateOpen,
    closeGateIntent: closeGate.closeGateIntent,
    stayAfterCloseAttempt: closeGate.stayAfterCloseAttempt,
    discardUnsavedAndClose: () => void closeGate.discardUnsavedAndClose(),
    saveAndClose: () => void closeGate.saveAndClose(),
    transcribeNavBlockOpen: closeGate.transcribeNavBlockOpen,
    transcribeNavBlockStopping: closeGate.transcribeNavBlockStopping,
    cancelTranscribeNavBlock: closeGate.cancelTranscribeNavBlock,
    confirmTranscribeNavBlock: () => closeGate.confirmTranscribeNavBlock(),
    hasUnsavedFileEdits,
  };
}

/** 导出 facade。 */
export type ExportLifecycleFacade = Pick<
  ProjectLifecycleApi,
  | "exportTxt"
  | "exportSrt"
  | "exportDeliveryDocx"
  | "exportDiagnosticBundle"
  | "exportProjectBundle"
  | "exportBundleScopeOpen"
  | "exportBundleScope"
  | "setExportBundleScope"
  | "closeExportBundleScope"
  | "confirmExportBundleScope"
  | "canExportCurrentProjectBundle"
  | "importProjectBundle"
  | "bundleImportConflictPending"
  | "bundleImportConflictDrafts"
  | "setBundleImportConflictDraft"
  | "applyAllBundleImportOverwrite"
  | "applyAllBundleImportRename"
  | "cancelBundleImportConflict"
  | "confirmBundleImportConflict"
>;

export function pickExportLifecycleFacade(exports: ExportApi): ExportLifecycleFacade {
  return {
    exportTxt: exports.exportTxt,
    exportSrt: exports.exportSrt,
    exportDeliveryDocx: exports.exportDeliveryDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle,
    exportProjectBundle: exports.exportProjectBundle,
    exportBundleScopeOpen: exports.exportBundleScopeOpen,
    exportBundleScope: exports.exportBundleScope,
    setExportBundleScope: exports.setExportBundleScope,
    closeExportBundleScope: exports.closeExportBundleScope,
    confirmExportBundleScope: exports.confirmExportBundleScope,
    canExportCurrentProjectBundle: exports.canExportCurrentProjectBundle,
    importProjectBundle: exports.importProjectBundle,
    bundleImportConflictPending: exports.bundleImportConflictPending,
    bundleImportConflictDrafts: exports.bundleImportConflictDrafts,
    setBundleImportConflictDraft: exports.setBundleImportConflictDraft,
    applyAllBundleImportOverwrite: exports.applyAllBundleImportOverwrite,
    applyAllBundleImportRename: exports.applyAllBundleImportRename,
    cancelBundleImportConflict: exports.cancelBundleImportConflict,
    confirmBundleImportConflict: exports.confirmBundleImportConflict,
  };
}

/** 转写 busy 时 Editor 预览态 — contract 真源。 */
export function deriveTranscribePreviewActive(
  busy: boolean,
  busyReason: BusyReason | null,
): boolean {
  return busy && busyReason === "transcribe";
}

/** 校验 facade 字段与源 controller 同步（contract test 用）。 */
export function assertCloseGateFacadeMatchesSource(
  facade: CloseGateLifecycleFacade,
  source: ProjectCloseGateControllerApi,
): void {
  if (facade.closeGateOpen !== source.closeGateOpen) {
    throw new Error("closeGateOpen mismatch");
  }
  if (facade.transcribeNavBlockOpen !== source.transcribeNavBlockOpen) {
    throw new Error("transcribeNavBlockOpen mismatch");
  }
  if (facade.closeGateIntent !== source.closeGateIntent) {
    throw new Error("closeGateIntent mismatch");
  }
}

export function assertExportFacadeMatchesSource(
  facade: ExportLifecycleFacade,
  source: ExportApi,
): void {
  if (facade.exportDeliveryDocx !== source.exportDeliveryDocx) {
    throw new Error("exportDeliveryDocx mismatch");
  }
}
