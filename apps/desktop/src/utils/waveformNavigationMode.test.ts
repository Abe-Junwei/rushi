import { describe, expect, it } from "vitest";
import { formatWaveformNavigationFooterLabel } from "./waveformNavigationMode";

describe("formatWaveformNavigationFooterLabel", () => {
  it("shows follow mode when auto-fit is on", () => {
    expect(
      formatWaveformNavigationFooterLabel({
        autoFitSelectionToViewport: true,
      }),
    ).toBe("波形：跟随语段");
  });

  it("shows manual when auto-fit is off", () => {
    expect(
      formatWaveformNavigationFooterLabel({
        autoFitSelectionToViewport: false,
      }),
    ).toBe("波形：手动缩放");
  });
});
