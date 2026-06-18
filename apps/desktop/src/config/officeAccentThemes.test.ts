import { describe, expect, it } from "vitest";
import { OFFICE_ACCENT_THEME_PRESETS } from "./officeAccentThemes";

describe("officeAccentThemes", () => {
  it("exposes brand plus seven accent color presets", () => {
    expect(OFFICE_ACCENT_THEME_PRESETS).toHaveLength(8);
    expect(OFFICE_ACCENT_THEME_PRESETS.map((preset) => preset.id)).toEqual([
      "brand",
      "blue",
      "red",
      "orange",
      "green",
      "pink",
      "teal",
      "gray",
    ]);
  });
});
