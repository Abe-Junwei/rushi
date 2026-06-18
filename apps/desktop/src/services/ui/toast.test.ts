import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearActivityFeedForTests, getActivityFeedSnapshot } from "./activityFeed";
import {
  dismissToast,
  getToasts,
  pushTranscribeResultToast,
  pushTranscribeHintsToToast,
  runToastAction,
  showToast,
  toast,
} from "./toast";

describe("toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
    clearActivityFeedForTests();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    dismissToast();
    clearActivityFeedForTests();
    vi.useRealTimers();
  });

  it("shows and auto-dismisses info toast", () => {
    showToast({ variant: "info", message: "保存成功" });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]?.message).toBe("保存成功");
    vi.advanceTimersByTime(6_000);
    expect(getToasts()).toHaveLength(0);
  });

  it("replaces prior toast instead of stacking", () => {
    toast.info("a");
    toast.info("b");
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]?.message).toBe("b");
  });

  it("dedupes identical message within window", () => {
    toast.warning("same");
    const id = getToasts()[0]?.id;
    toast.warning("same");
    expect(getToasts()[0]?.id).toBe(id);
    vi.advanceTimersByTime(3_000);
    toast.warning("same");
    expect(getToasts()[0]?.id).not.toBe(id);
  });

  it("merges transcribe hints into one warning toast", () => {
    pushTranscribeHintsToToast(["提示一", "提示二"]);
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]?.message).toBe("提示一 · 提示二");
    expect(getToasts()[0]?.variant).toBe("warning");
  });

  it("merges transcribe hints as error when any line looks like failure", () => {
    pushTranscribeHintsToToast(["部分完成", "转写失败"]);
    expect(getToasts()[0]?.variant).toBe("error");
  });

  it("runs toast action without dismissing", () => {
    const onAction = vi.fn();
    const id = showToast({
      variant: "success",
      message: "转写完成",
      action: { label: "转写后处理…", onClick: onAction },
    });
    expect(getToasts()[0]?.actionLabel).toBe("转写后处理…");
    runToastAction(id);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(getToasts()).toHaveLength(1);
  });

  it("pushTranscribeResultToast shows summary only", () => {
    pushTranscribeResultToast("转写完成：用时 5 秒，3 条语段，120 字");
    expect(getToasts()[0]?.message).toBe("转写完成：用时 5 秒，3 条语段，120 字");
    expect(getToasts()[0]?.variant).toBe("success");
    expect(getToasts()[0]?.actionLabel).toBeUndefined();
  });

  it("mirrors success/warning/error to activity feed", () => {
    toast.info("忽略 info");
    toast.success("保存成功");
    toast.error("失败");
    const feed = getActivityFeedSnapshot();
    expect(feed).toHaveLength(2);
    expect(feed.some((item) => item.message === "保存成功" && item.variant === "success")).toBe(true);
    expect(feed.some((item) => item.message === "失败" && item.variant === "error")).toBe(true);
  });

  it("pushTranscribeResultToast can attach delivery mode action", () => {
    const onAction = vi.fn();
    pushTranscribeResultToast("转写完成", { label: "定稿模式…", onClick: onAction });
    expect(getToasts()[0]?.actionLabel).toBe("定稿模式…");
    const toasts = getToasts();
    expect(toasts).toHaveLength(1);
    runToastAction(toasts[0].id);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
