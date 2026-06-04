import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AsrSetupReport } from "../../services/asr/asrSetupContract";
import { ASR_SETUP_INITIAL_STEPS } from "../../services/asr/asrSetupContract";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { LocalAsrSetupWizard } from "./LocalAsrSetupWizard";

vi.mock("../../config/env", () => ({
  isTauriRuntime: () => true,
}));

afterEach(() => {
  cleanup();
});

function makeSetup(overrides: Partial<AsrSetupControllerApi> = {}): AsrSetupControllerApi {
  return {
    setupReport: null,
    localRuntimeDiag: null,
    setupSteps: ASR_SETUP_INITIAL_STEPS,
    setupBusy: false,
    diagnoseBusy: false,
    setupMessage: "",
    setupOutcome: "idle",
    portConflict: false,
    refreshSetupDiagnose: vi.fn(() => Promise.resolve({} as AsrSetupReport)),
    refreshLocalRuntimeDiagnose: vi.fn(() => Promise.resolve(null)),
    downloadLocalRuntime: vi.fn(() => Promise.resolve()),
    cancelLocalRuntime: vi.fn(() => Promise.resolve()),
    revalidateLocalRuntime: vi.fn(() => Promise.resolve()),
    clearLocalRuntime: vi.fn(() => Promise.resolve()),
    restorePreviousLocalRuntime: vi.fn(() => Promise.resolve()),
    runOneClickAsrPrepare: vi.fn(() => Promise.resolve()),
    acceptForeignPortService: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe("LocalAsrSetupWizard", () => {
  it("places primary actions before the step list", () => {
    render(
      <LocalAsrSetupWizard
        setup={makeSetup()}
        busy={false}
        openAppDataFolder={vi.fn(() => Promise.resolve())}
        exportDiagnosticBundle={vi.fn(() => Promise.resolve())}
        embedded
      />,
    );

    const prepare = screen.getByRole("button", { name: "一键准备" });
    const steps = screen.getByRole("list", { name: "准备步骤" });
    expect(prepare.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows port conflict action in the primary action row", () => {
    render(
      <LocalAsrSetupWizard
        setup={makeSetup({ portConflict: true })}
        busy={false}
        openAppDataFolder={vi.fn(() => Promise.resolve())}
        exportDiagnosticBundle={vi.fn(() => Promise.resolve())}
      />,
    );

    expect(screen.getByRole("button", { name: "使用当前 8741 服务" })).toBeTruthy();
  });

  it("compact error state omits step list and setup description", () => {
    render(
      <LocalAsrSetupWizard
        setup={makeSetup()}
        busy={false}
        openAppDataFolder={vi.fn(() => Promise.resolve())}
        exportDiagnosticBundle={vi.fn(() => Promise.resolve())}
        compact
      />,
    );

    expect(screen.queryByText("自动完成侧车、能力检测与模型下载。")).toBeNull();
    expect(screen.queryByRole("list", { name: "准备步骤" })).toBeNull();
  });
});
