import { describe, expect, it } from "vitest";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_DANGER_COMPACT,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_PRIMARY_PROMINENT,
  CONTROL_BTN_SECONDARY,
  CONTROL_BTN_SECONDARY_PROMINENT,
  CONTROL_SELECT,
  CONTROL_TEXT_INPUT,
} from "./controlStyles";

describe("controlStyles", () => {
  it("uses Notion Zen 4px radius (rounded-sm)", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("rounded-sm");
    expect(CONTROL_BTN_SECONDARY).toContain("rounded-sm");
    expect(CONTROL_TEXT_INPUT).toContain("rounded-sm");
    expect(CONTROL_SELECT).toContain("rounded-sm");
  });

  it("uses 32px control height", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("h-8");
    expect(CONTROL_BTN_PRIMARY).toContain("min-h-[32px]");
    expect(CONTROL_TEXT_INPUT).toContain("min-h-[32px]");
  });

  it("uses shadow-none on text inputs", () => {
    expect(CONTROL_TEXT_INPUT).toContain("shadow-none");
    expect(CONTROL_SELECT).toContain("shadow-none");
  });

  it("uses sidebar + hairline for secondary and canvas for inputs", () => {
    expect(CONTROL_BTN_SECONDARY).toContain("bg-notion-sidebar");
    expect(CONTROL_BTN_SECONDARY).toContain("border-notion-border");
    expect(CONTROL_TEXT_INPUT).toContain("bg-notion-bg");
  });

  it("uses outline danger (cinnabar border/text, fill on hover)", () => {
    expect(CONTROL_BTN_DANGER).toContain("border-zen-cinnabar");
    expect(CONTROL_BTN_DANGER).toContain("text-zen-cinnabar");
    expect(CONTROL_BTN_DANGER).toContain("hover:bg-zen-cinnabar");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("border-zen-cinnabar");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("text-zen-cinnabar");
  });

  it("exposes prominent 40px hero controls", () => {
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("h-10");
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("min-h-[40px]");
    expect(CONTROL_BTN_SECONDARY_PROMINENT).toContain("rounded-sm");
  });
});
