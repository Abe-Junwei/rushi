import { describe, expect, it } from "vitest";
import {
  P1_CLAY_BTN_PRIMARY,
  P1_CLAY_BTN_SECONDARY,
  P1_CLAY_SELECT,
  P1_CLAY_TEXT_INPUT,
} from "./p1ControlStyles";

describe("p1ControlStyles", () => {
  it("maps Clay rounded.md (12px) to rounded-xl", () => {
    expect(P1_CLAY_BTN_PRIMARY).toContain("rounded-xl");
    expect(P1_CLAY_BTN_SECONDARY).toContain("rounded-xl");
    expect(P1_CLAY_TEXT_INPUT).toContain("rounded-xl");
    expect(P1_CLAY_SELECT).toContain("rounded-xl");
  });

  it("uses 44px control height", () => {
    expect(P1_CLAY_BTN_PRIMARY).toContain("h-11");
    expect(P1_CLAY_BTN_PRIMARY).toContain("min-h-[44px]");
    expect(P1_CLAY_TEXT_INPUT).toContain("min-h-[44px]");
  });

  it("uses shadow-none on text inputs", () => {
    expect(P1_CLAY_TEXT_INPUT).toContain("shadow-none");
    expect(P1_CLAY_SELECT).toContain("shadow-none");
  });

  it("uses canvas + hairline for secondary and inputs", () => {
    expect(P1_CLAY_BTN_SECONDARY).toContain("bg-app-bg");
    expect(P1_CLAY_BTN_SECONDARY).toContain("border-zen-gray-300");
    expect(P1_CLAY_TEXT_INPUT).toContain("bg-app-bg");
  });
});
