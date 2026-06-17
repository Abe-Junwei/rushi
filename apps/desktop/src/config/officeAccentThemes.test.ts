import { describe, expect, it } from "vitest";
import { OFFICE_ACCENT_THEME_PRESETS } from "./officeAccentThemes";

describe("officeAccentThemes", () => {
  it("exposes brand plus eight accent color presets", () => {
    expect(OFFICE_ACCENT_THEME_PRESETS).toHaveLength(9);
    expect(OFFICE_ACCENT_THEME_PRESETS.map((preset) => preset.id)).toEqual([
      "brand",
      "blue",
      "red",
      "orange",
      "green",
      "purple",
      "pink",
      "teal",
      "gray",
    ]);
  });
});
