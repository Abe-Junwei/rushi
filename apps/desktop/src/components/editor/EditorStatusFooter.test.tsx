/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorStatusFooter } from "./EditorStatusFooter";

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    busy: false,
    autoSaveFooterStatus: "idle",
    undo: vi.fn(),
    redo: vi.fn(),
    ...overrides,
  } as never;
}

function makeEditHistory(overrides: Record<string, unknown> = {}) {
  return {
    historyDisabled: false,
    historyOpen: false,
    historyBusy: false,
    historyError: null,
    historyRows: [],
    toggleHistory: vi.fn(),
    loadEditHistory: vi.fn(),
    setHistoryOpen: vi.fn(),
    canRestoreRow: () => false,
    requestRestore: vi.fn(),
    restoreBusy: false,
    ...overrides,
  } as never;
}

describe("EditorStatusFooter", () => {
  it("uses three-column grid layout without absolute center positioning", () => {
    const { container } = render(
      <EditorStatusFooter
        controller={makeController()}
        editHistory={makeEditHistory()}
        centerLabel="正在优化波形…"
        showCenterLabel
        segmentCount={12}
        charCount={3456}
      />,
    );

    const footer = container.querySelector(".editor-status-footer");
    expect(footer).toBeTruthy();
    expect(footer?.className).not.toMatch(/absolute/);
    expect(container.querySelector(".editor-status-footer-start")).toBeTruthy();
    expect(container.querySelector(".editor-status-footer-center")).toBeTruthy();
    expect(container.querySelector(".editor-status-footer-end")).toBeTruthy();
    expect(screen.getByText("正在优化波形…")).toBeTruthy();
    expect(screen.getByText(/12 条语段/)).toBeTruthy();
  });

  it("omits center hint when showCenterLabel is false", () => {
    const { container } = render(
      <EditorStatusFooter
        controller={makeController()}
        editHistory={makeEditHistory()}
        centerLabel="正在优化波形…"
        showCenterLabel={false}
        segmentCount={1}
        charCount={10}
      />,
    );

    expect(container.querySelector(".editor-status-footer-hint")).toBeNull();
    expect(container.querySelector(".editor-status-footer-center")?.textContent).toBe("");
  });

  it("marks shortcut hints with dedicated styling class", () => {
    const { container } = render(
      <EditorStatusFooter
        controller={makeController()}
        editHistory={makeEditHistory()}
        centerLabel="⌘/Ctrl + F · 查找与替换"
        centerHintKind="shortcut"
        showCenterLabel
        segmentCount={1}
        charCount={10}
      />,
    );

    expect(container.querySelector(".editor-status-footer-hint--shortcut")).toBeTruthy();
  });
});
