import { describe, expect, it } from "vitest";
import {
  assertCloseGateFacadeMatchesSource,
  assertExportFacadeMatchesSource,
  deriveTranscribePreviewActive,
  pickCloseGateLifecycleFacade,
  pickExportLifecycleFacade,
} from "./projectLifecycleFacades";
import type { ProjectCloseGateControllerApi } from "./useProjectCloseGateController";
import type { ExportApi } from "./useExportController";

describe("projectLifecycleFacades contract", () => {
  it("deriveTranscribePreviewActive only when busy transcribe", () => {
    expect(deriveTranscribePreviewActive(true, "transcribe")).toBe(true);
    expect(deriveTranscribePreviewActive(true, "export")).toBe(false);
    expect(deriveTranscribePreviewActive(false, "transcribe")).toBe(false);
  });

  it("pickCloseGateLifecycleFacade mirrors close gate controller", () => {
    const source = {
      loadProject: async () => {},
      loadProjectAfterImport: async () => {},
      refreshProjectHub: async () => {},
      openFileWrapped: async () => {},
      openLastEditorWorkspace: async () => {},
      closeFileWrapped: () => {},
      closeProjectWrapped: () => {},
      closeGateOpen: true,
      closeGateIntent: "navigate" as const,
      stayAfterCloseAttempt: () => {},
      discardUnsavedAndClose: async () => {},
      saveAndClose: async () => {},
      transcribeNavBlockOpen: false,
      transcribeNavBlockStopping: false,
      cancelTranscribeNavBlock: () => {},
      confirmTranscribeNavBlock: async () => {},
      runWithUnsavedNavigateGate: async (onProceed) => {
        await onProceed();
        return true;
      },
    } satisfies ProjectCloseGateControllerApi;

    const facade = pickCloseGateLifecycleFacade(source, () => true);
    expect(() => assertCloseGateFacadeMatchesSource(facade, source)).not.toThrow();
    expect(facade.hasUnsavedFileEdits()).toBe(true);
  });

  it("pickExportLifecycleFacade mirrors export controller", () => {
    const exportDeliveryDocx = async () => {};
    const source = {
      exportTxt: async () => {},
      exportSrt: async () => {},
      exportDocx: async () => {},
      exportDeliveryDocx,
      exportDiagnosticBundle: async () => {},
      exportProjectBundle: async () => {},
      importProjectBundle: async () => {},
    } satisfies ExportApi;

    const facade = pickExportLifecycleFacade(source);
    expect(() => assertExportFacadeMatchesSource(facade, source)).not.toThrow();
    expect(facade.exportDeliveryDocx).toBe(exportDeliveryDocx);
  });
});
