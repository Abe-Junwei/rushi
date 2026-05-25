import { describe, expect, it } from "vitest";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_DANGER_COMPACT,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_SELECT,
  CONTROL_TEXT_INPUT,
} from "./controlStyles";

describe("controlStyles", () => {
  it("maps Serene rounded.md (12px) to rounded-xl", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("rounded-xl");
    expect(CONTROL_BTN_SECONDARY).toContain("rounded-xl");
    expect(CONTROL_TEXT_INPUT).toContain("rounded-xl");
    expect(CONTROL_SELECT).toContain("rounded-xl");
  });

  it("uses 44px control height", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("h-11");
    expect(CONTROL_BTN_PRIMARY).toContain("min-h-[44px]");
    expect(CONTROL_TEXT_INPUT).toContain("min-h-[44px]");
  });

  it("uses shadow-none on text inputs", () => {
    expect(CONTROL_TEXT_INPUT).toContain("shadow-none");
    expect(CONTROL_SELECT).toContain("shadow-none");
  });

  it("uses canvas + hairline for secondary and inputs", () => {
    expect(CONTROL_BTN_SECONDARY).toContain("bg-notion-bg");
    expect(CONTROL_BTN_SECONDARY).toContain("border-notion-border");
    expect(CONTROL_TEXT_INPUT).toContain("bg-notion-bg");
  });

  it("uses cinnabar semantic for danger buttons", () => {
    expect(CONTROL_BTN_DANGER).toContain("bg-zen-cinnabar");
    expect(CONTROL_BTN_DANGER).toContain("text-notion-bg");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("bg-zen-cinnabar");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("text-notion-bg");
  });
});
