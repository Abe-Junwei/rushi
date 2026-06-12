import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SIDEBAR_NAV_STACK,
  workspaceSidebarNavItemClass,
  workspaceSidebarSubNavItemClass,
  WORKSPACE_SIDEBAR_FOOTER_GRID,
  workspaceSidebarFooterItemClass,
} from "./workspaceShellLayout";

describe("workspaceShellLayout sidebar nav", () => {
  it("uses inset rounded blocks for primary nav", () => {
    expect(WORKSPACE_SIDEBAR_NAV_STACK).toContain("px-3");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("rounded-md");
    expect(workspaceSidebarNavItemClass({ active: false })).toContain("min-h-10");
    expect(workspaceSidebarNavItemClass({ active: true })).toContain("bg-notion-sidebar-active");
  });

  it("styles subnav with smaller height and saffron active state", () => {
    expect(workspaceSidebarSubNavItemClass(false)).toContain("min-h-9");
    expect(workspaceSidebarSubNavItemClass(true)).toContain("text-zen-saffron");
  });

  it("styles footer as horizontal peer cells", () => {
    expect(WORKSPACE_SIDEBAR_FOOTER_GRID).toContain("grid");
    expect(workspaceSidebarFooterItemClass({ active: false })).toContain("flex-col");
    expect(workspaceSidebarFooterItemClass({ active: true })).toContain("bg-notion-sidebar-active");
  });
});
