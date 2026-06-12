import { describe, expect, it } from "vitest";
import {
  detectShortcutMenuPlatform,
  editorShortcutMenuHint,
  formatShortcutBindingMenuLabel,
} from "./editorShortcutMenuHint";

describe("editorShortcutMenuHint", () => {
  it("formats mac menu hints without mono-style separators", () => {
    expect(
      formatShortcutBindingMenuLabel({ key: "j", mod: true }, "mac"),
    ).toBe("⌘J");
    expect(
      formatShortcutBindingMenuLabel({ key: ",", mod: true }, "mac"),
    ).toBe("⌘,");
    expect(
      formatShortcutBindingMenuLabel({ key: " ", mod: true, shift: true }, "mac"),
    ).toBe("⇧⌘Space");
  });

  it("formats windows menu hints with plus separators", () => {
    expect(
      formatShortcutBindingMenuLabel({ key: "l", mod: true }, "win"),
    ).toBe("Ctrl+L");
  });

  it("maps registry ids to menu hints", () => {
    expect(editorShortcutMenuHint("segment.mergeNext", "mac")).toBe("⌘J");
    expect(editorShortcutMenuHint("workflow.addCorrectionMemory", "mac")).toBe("⌘L");
  });

  it("detectShortcutMenuPlatform treats macOS as mac", () => {
    expect(detectShortcutMenuPlatform("MacIntel")).toBe("mac");
    expect(detectShortcutMenuPlatform("Win32")).toBe("win");
  });
});
