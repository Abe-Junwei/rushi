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
    transcribeSource: "local" as const,
    onlineTranscribeReady: false,
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

  it("pins auto-transcribe outside the compact edit menu", () => {
    const { container } = render(
      <EditorSegmentTranscribeActions controller={makeController()} compactLayout />,
    );

    expect(screen.getByRole("button", { name: "自动转录" })).toBeTruthy();
    expect(screen.getByLabelText("编辑菜单")).toBeTruthy();
    expect(container.querySelector(".workbench-compact-menu")).toBeTruthy();
    // Direct children: pinned transcribe + overflow trigger (details/summary, not raw > button only).
    expect(screen.getByRole("button", { name: "自动转录" }).closest(".waveform-toolbar-transcribe")).toBeTruthy();
  });

  it("does not bury auto-transcribe inside the compact edit menu", () => {
    render(
      <EditorSegmentTranscribeActions
        controller={makeController({ segments: [] })}
        compactLayout
      />,
    );

    const pinned = screen.getByRole("button", { name: "自动转录" });
    expect(pinned.closest(".workbench-compact-menu-panel")).toBeNull();
    fireEvent.click(screen.getByLabelText("编辑菜单"));
    expect(screen.queryByRole("menuitem", { name: "自动转录" })).toBeNull();
    // Menu still has secondary edit actions.
    expect(screen.getByRole("button", { name: "规则纠错" })).toBeTruthy();
  });

  it("keeps compact edit menu while transcribing; stop lives in progress panel", () => {
    render(
      <EditorSegmentTranscribeActions
        controller={makeController({ busy: true, busyReason: "transcribe" })}
        compactLayout
      />,
    );

    expect(screen.getByLabelText("编辑菜单")).toBeTruthy();
    expect(screen.getByRole("button", { name: "自动转录" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /停止转写/ })).toBeNull();
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

  it("keeps transcribe enabled during model download when online STT is ready", () => {
    render(
      <EditorSegmentTranscribeActions
        controller={makeController({
          prepareModelBusy: true,
          transcribeSource: "online",
          onlineTranscribeReady: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "自动转录" }).hasAttribute("disabled")).toBe(false);
  });
});
