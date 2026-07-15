import { describe, expect, it } from "vitest";
import { readPanelTemplatePresetPersistState } from "./PanelTemplate";

describe("PanelTemplate presets", () => {
  it("persists environment panel size between sessions", () => {
    expect(readPanelTemplatePresetPersistState("environment")).toBe(true);
  });

  it("persists compactDialog and findReplace sizes by default", () => {
    expect(readPanelTemplatePresetPersistState("compactDialog")).toBe(true);
    expect(readPanelTemplatePresetPersistState("findReplace")).toBe(true);
  });

  it("persists createProject preset size between sessions", () => {
    expect(readPanelTemplatePresetPersistState("createProject")).toBe(true);
  });

  it("does not persist app update confirm (explicit opt-out in component)", () => {
    expect(readPanelTemplatePresetPersistState("compactDialog")).toBe(true);
  });
});
