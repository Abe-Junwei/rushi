import { describe, expect, it } from "vitest";
import { OFFICE_SHELL_THEME_PRESETS } from "./officeShellThemes";

describe("officeShellThemes", () => {
  it("exposes five Office shell presets", () => {
    expect(OFFICE_SHELL_THEME_PRESETS).toHaveLength(5);
    expect(OFFICE_SHELL_THEME_PRESETS.map((preset) => preset.id)).toEqual([
      "default",
      "white",
      "light-gray",
      "dark-gray",
      "black",
    ]);
  });
});
