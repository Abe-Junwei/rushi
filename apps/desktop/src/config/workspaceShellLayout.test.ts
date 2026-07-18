import { describe, expect, it } from "vitest";
import {
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_TAB_GAP,
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
  });
});

describe("workspaceShellLayout sidebar nav", () => {
  it("uses inset rounded blocks for primary nav with airy stack", () => {
    expect(WORKSPACE_SIDEBAR_NAV_STACK).toContain("px-5");
    expect(WORKSPACE_SIDEBAR_NAV_STACK).toContain("gap-6");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("rounded-md");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("min-h-10");
    expect(workspaceSidebarNavItemClass({ active: true })).toContain("bg-notion-sidebar-active");
  });

  it("styles subnav with smaller height and saffron active state", () => {
    expect(workspaceSidebarSubNavItemClass(false)).toContain("min-h-9");
    expect(workspaceSidebarSubNavItemClass(true)).toContain("text-accent-action");
  });

  it("styles footer as vertical icon+label stack", () => {
    expect(WORKSPACE_SIDEBAR_FOOTER_STACK).toContain("flex-col");
    expect(WORKSPACE_SIDEBAR_FOOTER_STACK).toContain("gap-4");
    expect(workspaceSidebarFooterItemClass({ active: false })).toContain("gap-3");
    expect(workspaceSidebarFooterItemClass({ active: false })).not.toContain("flex-col");
    expect(workspaceSidebarFooterItemClass({ active: true })).toContain("bg-notion-sidebar-active");
  });

  it("exposes sidebar empty project hint button token", async () => {
    const { WORKSPACE_SIDEBAR_EMPTY_HINT_BTN } = await import("./workspaceShellLayout");
    expect(WORKSPACE_SIDEBAR_EMPTY_HINT_BTN).toContain("hover:bg-notion-sidebar-hover");
    expect(WORKSPACE_SIDEBAR_EMPTY_HINT_BTN).toContain("px-5");
  });

  it("keeps welcome ledger tab/row horizontal inset aligned", () => {
    expect(WELCOME_LEDGER_INSET_X).toBe("px-6");
    expect(WELCOME_LEDGER_TAB_GAP).toBe("gap-8");
  });
});
