import { describe, expect, it } from "vitest";
import {
  CLAY_BTN_PRIMARY,
  CLAY_BTN_SECONDARY,
  CLAY_SELECT,
  CLAY_TEXT_INPUT,
} from "./controlStyles";

describe("controlStyles", () => {
  it("maps Clay rounded.md (12px) to rounded-xl", () => {
    expect(CLAY_BTN_PRIMARY).toContain("rounded-xl");
    expect(CLAY_BTN_SECONDARY).toContain("rounded-xl");
    expect(CLAY_TEXT_INPUT).toContain("rounded-xl");
    expect(CLAY_SELECT).toContain("rounded-xl");
  });

  it("uses 44px control height", () => {
    expect(CLAY_BTN_PRIMARY).toContain("h-11");
    expect(CLAY_BTN_PRIMARY).toContain("min-h-[44px]");
    expect(CLAY_TEXT_INPUT).toContain("min-h-[44px]");
  });

  it("uses shadow-none on text inputs", () => {
    expect(CLAY_TEXT_INPUT).toContain("shadow-none");
    expect(CLAY_SELECT).toContain("shadow-none");
  });

  it("uses canvas + hairline for secondary and inputs", () => {
    expect(CLAY_BTN_SECONDARY).toContain("bg-app-bg");
    expect(CLAY_BTN_SECONDARY).toContain("border-zen-gray-300");
    expect(CLAY_TEXT_INPUT).toContain("bg-app-bg");
  });
});
