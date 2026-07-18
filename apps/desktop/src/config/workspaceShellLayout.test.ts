import { describe, expect, it } from "vitest";
import {
  WELCOME_HOME_STACK_GAP,
  WELCOME_LEDGER_DIVIDER_PT,
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_TAB_GAP,
  WELCOME_LEDGER_TAB_MB,
  WORKSPACE_SIDEBAR_NAV_STACK,
  workspaceSidebarNavItemClass,
  workspaceSidebarSubNavItemClass,
  WORKSPACE_SIDEBAR_FOOTER_STACK,
  workspaceSidebarFooterItemClass,
  WORKSPACE_HOME_STAGE_CLASS,
} from "./workspaceShellLayout";
import { MAIN_SHELL_SURFACE_CLASS } from "./shellVisualTokens";

describe("workspaceShellLayout shell grid", () => {
  it("uses CSS-fixed class for welcome/hub grid (not Tailwind-only arbitrary cols)", async () => {
    const {
      WORKSPACE_SHELL_GRID_CLASS,
      WORKSPACE_SHELL_COLLAPSIBLE_CLASS,
      EDITOR_WORKSPACE_TOOLBAR_HEIGHT,
      EDITOR_WORKSPACE_FOOTER_HEIGHT,
    } = await import("./workspaceShellLayout");
    expect(WORKSPACE_SHELL_GRID_CLASS).toContain("workspace-shell-fixed");
    expect(WORKSPACE_SHELL_GRID_CLASS).not.toContain("grid-cols-[");
    expect(WORKSPACE_SHELL_COLLAPSIBLE_CLASS).toContain("workspace-shell-collapsible");
    expect(WORKSPACE_SHELL_COLLAPSIBLE_CLASS).not.toContain("grid-cols-[20rem");
    expect(EDITOR_WORKSPACE_TOOLBAR_HEIGHT).toBe("3rem");
    expect(EDITOR_WORKSPACE_FOOTER_HEIGHT).toBe("30px");
    expect(WORKSPACE_HOME_STAGE_CLASS).toContain(MAIN_SHELL_SURFACE_CLASS.pageBg);
    expect(WORKSPACE_HOME_STAGE_CLASS).toContain("overflow-hidden");
    expect(WORKSPACE_HOME_STAGE_CLASS).not.toContain("overflow-y-auto");
  });
});

describe("workspaceShellLayout sidebar nav", () => {
  it("uses compact text+icon primary nav on 8px grid", () => {
    expect(WORKSPACE_SIDEBAR_NAV_STACK).toContain("px-5");
    expect(WORKSPACE_SIDEBAR_NAV_STACK).toContain("gap-2");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("min-h-8");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("text-notion-text-muted");
    expect(workspaceSidebarNavItemClass({ active: true })).toContain("font-semibold");
    expect(workspaceSidebarNavItemClass({ active: true })).toContain("text-notion-text");
    expect(workspaceSidebarNavItemClass({ active: true })).not.toContain("bg-notion-sidebar-active");
  });

  it("styles subnav with compact height and accent active text", () => {
    expect(workspaceSidebarSubNavItemClass(false)).toContain("min-h-8");
    expect(workspaceSidebarSubNavItemClass(true)).toContain("text-accent-action");
  });

  it("styles footer as horizontal row with prior ghost icon+label buttons", () => {
    expect(WORKSPACE_SIDEBAR_FOOTER_STACK).toContain("flex-row");
    expect(workspaceSidebarFooterItemClass({ active: false })).toContain("gap-3");
    expect(workspaceSidebarFooterItemClass({ active: false })).toContain("rounded-md");
    expect(workspaceSidebarFooterItemClass({ active: false })).not.toContain("border-notion-border");
    expect(workspaceSidebarFooterItemClass({ active: true })).toContain("bg-notion-sidebar-active");
  });

  it("exposes sidebar empty project hint button token", async () => {
    const { WORKSPACE_SIDEBAR_EMPTY_HINT_BTN } = await import("./workspaceShellLayout");
    expect(WORKSPACE_SIDEBAR_EMPTY_HINT_BTN).toContain("hover:bg-notion-sidebar-hover");
    expect(WORKSPACE_SIDEBAR_EMPTY_HINT_BTN).toContain("px-5");
  });

  it("keeps welcome home / ledger spacing on 8px grid with φ-adjacent section break", () => {
    expect(WELCOME_HOME_STACK_GAP).toBe("gap-6");
    expect(WELCOME_LEDGER_DIVIDER_PT).toBe("pt-4");
    expect(WELCOME_LEDGER_INSET_X).toBe("px-6");
    expect(WELCOME_LEDGER_TAB_GAP).toBe("gap-6");
    expect(WELCOME_LEDGER_TAB_MB).toBe("mb-4");
  });
});
