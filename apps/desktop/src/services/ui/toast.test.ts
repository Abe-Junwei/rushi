import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissToast,
  getToasts,
  pushTranscribeHintsToToast,
  showToast,
  toast,
} from "./toast";

describe("toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    dismissToast();
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
});
