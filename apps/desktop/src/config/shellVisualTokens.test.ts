import { describe, expect, it } from "vitest";
import { COLORS } from "./tokens";
import {
  FLAT_OVERLAY_PANEL_SHELL_CLASS,
  FLAT_SHELL_ELEVATION_CLASS,
  MAIN_SHELL_SURFACE_CLASS,
  OVERLAY_SCRIM_LAYER_CLASS,
  OVERLAY_SCRIM_SURFACE_CLASS,
  SHELL_ACCENT,
  SHELL_SURFACE_MIGRATION_MAP,
  SHELL_VISUAL_CSS_VARS,
  CONTENT_DECORATION_SURFACE_CLASS,
} from "./shellVisualTokens";

describe("shellVisualTokens", () => {
  it("exports stable CSS var names for tokens.css parity", () => {
    expect(SHELL_VISUAL_CSS_VARS.mainShellBg).toBe("--main-shell-bg");
    expect(SHELL_VISUAL_CSS_VARS.accentEdit).toBe("--accent-edit");
    expect(SHELL_VISUAL_CSS_VARS.shellElevationShadow).toBe("--shell-elevation-shadow");
  });

  it("uses flat elevation and overlay border on panel shell class", () => {
    expect(FLAT_OVERLAY_PANEL_SHELL_CLASS).toContain("shadow-none");
    expect(FLAT_OVERLAY_PANEL_SHELL_CLASS).toContain("border-notion-border");
    expect(FLAT_SHELL_ELEVATION_CLASS).toBe("shadow-none");
  });

  it("uses tokenized scrim for modal overlays", () => {
    expect(SHELL_VISUAL_CSS_VARS.overlayScrimBg).toBe("--overlay-scrim-bg");
    expect(OVERLAY_SCRIM_SURFACE_CLASS.bg).toContain("--overlay-scrim-bg");
    expect(OVERLAY_SCRIM_LAYER_CLASS).not.toContain("backdrop-blur");
  });

  it("maps main shell surfaces to notion tokens", () => {
    expect(MAIN_SHELL_SURFACE_CLASS.pageBg).toBe("bg-notion-bg");
    expect(MAIN_SHELL_SURFACE_CLASS.sidebarBg).toBe("bg-notion-sidebar");
  });

  it("aligns dual accent semantic Tailwind prefixes with tokens.ts", () => {
    expect(SHELL_ACCENT.edit).toBe("accent-edit");
    expect(SHELL_ACCENT.action).toBe("accent-action");
    expect(SHELL_ACCENT.actionStrong).toBe("accent-action-strong");
    expect(SHELL_VISUAL_CSS_VARS.accentActionStrong).toBe("--accent-action-strong");
    expect(COLORS.accentEdit).toBe(COLORS.accentAction);
    expect(COLORS.accentAction).toBe(COLORS.saffron);
  });

  it("documents R2 migration targets for known debt surfaces", () => {
    const labels = SHELL_SURFACE_MIGRATION_MAP.map((row) => row.surface);
    expect(labels).toContain("DraggableResizablePanel shell");
    expect(labels).toContain("Minimap strip");
    expect(labels).toContain("Welcome / Hub shell (WorkspaceShellLayout, TopBar, Sidebar)");
  });

  it("exports content decoration surfaces separate from main shell", () => {
    expect(CONTENT_DECORATION_SURFACE_CLASS.paperBg).toBe("bg-content-decoration-paper");
    expect(CONTENT_DECORATION_SURFACE_CLASS.paperBg).not.toContain("notion");
  });
});
