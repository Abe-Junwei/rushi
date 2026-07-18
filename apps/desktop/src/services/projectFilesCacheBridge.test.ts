import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invalidateProjectFilesCaches,
  refreshRecentWorkspaceFiles,
  registerProjectFilesCacheInvalidator,
  registerRecentWorkspaceFilesRefresh,
} from "./projectFilesCacheBridge";

describe("projectFilesCacheBridge", () => {
  afterEach(() => {
    registerProjectFilesCacheInvalidator(null);
    registerRecentWorkspaceFilesRefresh(null);
  });

  it("invalidateProjectFilesCaches notifies project + recent listeners", () => {
    const onProjects = vi.fn();
    const onRecent = vi.fn();
    registerProjectFilesCacheInvalidator(onProjects);
    registerRecentWorkspaceFilesRefresh(onRecent);

    invalidateProjectFilesCaches(["p1", "p2"]);

    expect(onProjects).toHaveBeenCalledWith(["p1", "p2"]);
    expect(onRecent).toHaveBeenCalledTimes(1);
  });

  it("refreshRecentWorkspaceFiles only notifies recent listener", () => {
    const onProjects = vi.fn();
    const onRecent = vi.fn();
    registerProjectFilesCacheInvalidator(onProjects);
    registerRecentWorkspaceFilesRefresh(onRecent);

    refreshRecentWorkspaceFiles();

    expect(onProjects).not.toHaveBeenCalled();
    expect(onRecent).toHaveBeenCalledTimes(1);
  });
});
