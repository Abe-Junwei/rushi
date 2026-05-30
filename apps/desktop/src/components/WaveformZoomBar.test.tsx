import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaveformZoomBar } from "./WaveformZoomBar";

const baseProps = {
  disabled: false,
  isReady: true,
  pxPerSec: 56,
  viewportWidthPx: 800,
  durationSec: 120,
  onFitSelection: vi.fn(),
  onFitAll: vi.fn(),
  onResetDefaultZoom: vi.fn(),
  onPxPerSecChange: vi.fn(),
};

describe("WaveformZoomBar", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders discrete zoom commands without a range slider", () => {
    render(<WaveformZoomBar {...baseProps} />);

    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByRole("button", { name: "适配语段" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "整段可见" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "缩小" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "放大" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "重置缩放" })).toBeTruthy();
  });

  it("disables fit-selection until a segment is selected", () => {
    const onFitSelection = vi.fn();
    render(<WaveformZoomBar {...baseProps} onFitSelection={onFitSelection} />);

    const fitBtn = screen.getByRole("button", { name: "适配语段" });
    expect((fitBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(fitBtn);
    expect(onFitSelection).not.toHaveBeenCalled();
  });

  it("calls fit handlers when enabled", () => {
    const onFitSelection = vi.fn();
    const onFitAll = vi.fn();
    render(
      <WaveformZoomBar
        {...baseProps}
        selectedStartSec={10}
        selectedEndSec={14}
        onFitSelection={onFitSelection}
        onFitAll={onFitAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "适配语段" }));
    fireEvent.click(screen.getByRole("button", { name: "整段可见" }));

    expect(onFitSelection).toHaveBeenCalledTimes(1);
    expect(onFitAll).toHaveBeenCalledTimes(1);
  });
});
