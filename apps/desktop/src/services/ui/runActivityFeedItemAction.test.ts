import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityFeedItem } from "./activityFeed";
import { clearActivityFeedForTests } from "./activityFeed";
import { runActivityFeedItemAction } from "./runActivityFeedItemAction";

vi.mock("../deliveryModeTranscribeToast", () => ({
  runDeliveryModeTranscribeAction: vi.fn(),
}));

import { runDeliveryModeTranscribeAction } from "../deliveryModeTranscribeToast";

function item(partial: Partial<ActivityFeedItem> & Pick<ActivityFeedItem, "id">): ActivityFeedItem {
  return {
    variant: "success",
    message: "m",
    at: 0,
    read: false,
    ...partial,
  };
}

describe("runActivityFeedItemAction", () => {
  beforeEach(() => {
    clearActivityFeedForTests();
    vi.clearAllMocks();
  });

  it("uses openWorkspaceFile when provided for open-file action", async () => {
    const loadProject = vi.fn(() => Promise.resolve());
    const openFile = vi.fn(() => Promise.resolve());
    const openWorkspaceFile = vi.fn(() => Promise.resolve());
    await runActivityFeedItemAction(
      item({
        id: "1",
        actionKind: "open-file",
        projectId: "p1",
        fileId: "f1",
      }),
      { currentProjectId: "p2", loadProject, openFile, openWorkspaceFile },
    );
    expect(openWorkspaceFile).toHaveBeenCalledWith("p1", "f1");
    expect(loadProject).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
  });

  it("loads project and opens file for open-file action", async () => {
    const loadProject = vi.fn(() => Promise.resolve());
    const openFile = vi.fn(() => Promise.resolve());
    await runActivityFeedItemAction(
      item({
        id: "1",
        actionKind: "open-file",
        projectId: "p1",
        fileId: "f1",
      }),
      { currentProjectId: "p2", loadProject, openFile },
    );
    expect(loadProject).toHaveBeenCalledWith("p1");
    expect(openFile).toHaveBeenCalledWith("f1");
  });

  it("skips loadProject when already on target project", async () => {
    const loadProject = vi.fn(() => Promise.resolve());
    const openFile = vi.fn(() => Promise.resolve());
    await runActivityFeedItemAction(
      item({
        id: "1",
        actionKind: "open-file",
        projectId: "p1",
        fileId: "f1",
      }),
      { currentProjectId: "p1", loadProject, openFile },
    );
    expect(loadProject).not.toHaveBeenCalled();
    expect(openFile).toHaveBeenCalledWith("f1");
  });

  it("opens delivery mode for delivery-mode action", async () => {
    await runActivityFeedItemAction(item({ id: "1", actionKind: "delivery-mode" }), {
      currentProjectId: null,
      loadProject: vi.fn(() => Promise.resolve()),
      openFile: vi.fn(() => Promise.resolve()),
    });
    expect(runDeliveryModeTranscribeAction).toHaveBeenCalledTimes(1);
  });

  it("falls back to in-memory handler", async () => {
    const onAction = vi.fn();
    const { pushActivityFeedItem, getActivityFeedSnapshot } = await import("./activityFeed");
    pushActivityFeedItem({
      variant: "success",
      message: "x",
      action: { label: "Go", onClick: onAction },
    });
    const feedItem = getActivityFeedSnapshot()[0];
    expect(feedItem).toBeDefined();
    await runActivityFeedItemAction(feedItem, {
      currentProjectId: null,
      loadProject: vi.fn(() => Promise.resolve()),
      openFile: vi.fn(() => Promise.resolve()),
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
