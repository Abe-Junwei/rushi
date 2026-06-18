import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearActivityFeedForTests,
  clearActivityFeedHistory,
  getActivityFeedSnapshot,
  getActivityFeedUnreadCount,
  markActivityFeedRead,
  pushActivityFeedItem,
  runActivityFeedAction,
} from "./activityFeed";

describe("activityFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    clearActivityFeedForTests();
  });

  afterEach(() => {
    clearActivityFeedForTests();
    vi.useRealTimers();
  });

  it("stores unread items and marks them read", () => {
    pushActivityFeedItem({ variant: "success", message: "转写完成" });
    expect(getActivityFeedUnreadCount()).toBe(1);
    markActivityFeedRead();
    expect(getActivityFeedUnreadCount()).toBe(0);
    expect(getActivityFeedSnapshot()[0]?.read).toBe(true);
  });

  it("keeps action handlers in memory", () => {
    const onAction = vi.fn();
    const id = pushActivityFeedItem({
      variant: "success",
      message: "转写完成",
      action: { label: "定稿模式…", onClick: onAction },
    });
    runActivityFeedAction(id);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("persists structured metadata", () => {
    pushActivityFeedItem({
      variant: "error",
      message: "TXT导出失败",
      kind: "export",
      projectId: "p1",
      fileId: "f1",
      fileLabel: "a.wav",
      actionKind: "open-file",
      action: { label: "打开文件" },
    });
    const item = getActivityFeedSnapshot()[0];
    expect(item?.kind).toBe("export");
    expect(item?.projectId).toBe("p1");
    expect(item?.actionKind).toBe("open-file");
  });

  it("dedupes generic toasts by message but keeps distinct structured items", () => {
    pushActivityFeedItem({
      variant: "error",
      message: "批量转写失败：超时",
      kind: "batch_transcribe",
      projectId: "p1",
      fileId: "f1",
      fileLabel: "a.wav",
    });
    pushActivityFeedItem({
      variant: "error",
      message: "批量转写失败：超时",
      kind: "batch_transcribe",
      projectId: "p1",
      fileId: "f2",
      fileLabel: "b.wav",
    });
    expect(getActivityFeedSnapshot()).toHaveLength(2);
  });

  it("drops stale action handlers when replacing deduped items", () => {
    const first = vi.fn();
    const second = vi.fn();
    pushActivityFeedItem({
      variant: "success",
      message: "保存成功",
      action: { label: "打开", onClick: first },
    });
    pushActivityFeedItem({
      variant: "success",
      message: "保存成功",
      action: { label: "打开", onClick: second },
    });
    expect(getActivityFeedSnapshot()).toHaveLength(1);
    const item = getActivityFeedSnapshot()[0];
    expect(item).toBeDefined();
    runActivityFeedAction(item.id);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clears all feed items", () => {
    pushActivityFeedItem({ variant: "success", message: "a" });
    pushActivityFeedItem({ variant: "error", message: "b" });
    clearActivityFeedHistory();
    expect(getActivityFeedSnapshot()).toHaveLength(0);
    expect(getActivityFeedUnreadCount()).toBe(0);
  });
});
