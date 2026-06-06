/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSegmentTranscribeActions } from "./EditorSegmentToolbarActions";

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    segments: [{ id: "1" }],
    busy: false,
    busyReason: null,
    prepareModelBusy: false,
    transcribeCancelling: false,
    correctionRulesDialog: { phase: "closed" },
    postTranscribeStageBDialog: { phase: "closed" },
    findReplaceDialog: { phase: "closed" },
    canApplyCorrectionRules: true,
    canOfferPostTranscribeStageB: true,
    canFindReplace: true,
    runTranscribe: vi.fn(),
    openCorrectionRulesManual: vi.fn(),
    openPostTranscribeStageB: vi.fn(),
    openFindReplace: vi.fn(),
    cancelTranscribe: vi.fn(),
    ...overrides,
  } as never;
}

describe("EditorSegmentTranscribeActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders compact edit menu when compactLayout is true", () => {
    const { container } = render(
      <EditorSegmentTranscribeActions controller={makeController()} compactLayout />,
    );

    expect(screen.getByLabelText("编辑菜单")).toBeTruthy();
    expect(container.querySelector(".workbench-compact-menu")).toBeTruthy();
    expect(container.querySelectorAll(".waveform-toolbar-transcribe > button").length).toBe(0);
  });

  it("keeps stop button visible while transcribing in compact layout", () => {
    render(
      <EditorSegmentTranscribeActions
        controller={makeController({ busy: true, busyReason: "transcribe" })}
        compactLayout
      />,
    );

    expect(screen.getByRole("button", { name: /停止转写/ })).toBeTruthy();
    expect(screen.queryByLabelText("编辑菜单")).toBeNull();
  });

  it("opens find replace from compact menu", () => {
    const openFindReplace = vi.fn();
    render(
      <EditorSegmentTranscribeActions
        controller={makeController({ openFindReplace })}
        compactLayout
      />,
    );

    fireEvent.click(screen.getByLabelText("编辑菜单"));
    fireEvent.click(screen.getByRole("button", { name: "查找替换" }));
    expect(openFindReplace).toHaveBeenCalledTimes(1);
  });
});
