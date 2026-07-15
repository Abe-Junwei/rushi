import { describe, expect, it } from "vitest";
import { scaleUiPanelPx } from "../services/ui/uiDisplayScale";
import { readPanelTemplatePresetPersistState } from "./PanelTemplate";

describe("PanelTemplate UI scale defaults", () => {
  it("scales compact dialog default width at 125%", () => {
    const baseWidth = 400;
    expect(scaleUiPanelPx(baseWidth, 1.25)).toBe(500);
  });

  it("persists createProject preset", () => {
    expect(readPanelTemplatePresetPersistState("createProject")).toBe(true);
  });
});
