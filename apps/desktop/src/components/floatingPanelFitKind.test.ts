import { describe, expect, it } from "vitest";
import { resolveEffectivePanelFitKind, resolvePanelAutoHeight } from "./floatingPanelFitKind";

describe("floatingPanelFitKind", () => {
  it("maps autoFit / staticFit to CSS auto height", () => {
    expect(resolvePanelAutoHeight("autoFit")).toBe(true);
    expect(resolvePanelAutoHeight("staticFit")).toBe(true);
  });

  it("maps fill to fixed px height (no auto)", () => {
    expect(resolvePanelAutoHeight("fill")).toBe(false);
  });

  it("defaults missing fitKind to staticFit", () => {
    expect(resolveEffectivePanelFitKind(undefined)).toBe("staticFit");
    expect(resolveEffectivePanelFitKind("fill")).toBe("fill");
  });
});
