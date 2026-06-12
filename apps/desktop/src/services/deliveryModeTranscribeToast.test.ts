import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  pushTranscribeDeliveryModeToast,
  registerDeliveryModeTranscribeAction,
} from "./deliveryModeTranscribeToast";
import { getToasts, runToastAction } from "./ui/toast";

describe("deliveryModeTranscribeToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    registerDeliveryModeTranscribeAction(null);
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens delivery mode from transcribe toast action", () => {
    const open = vi.fn();
    registerDeliveryModeTranscribeAction(open);
    pushTranscribeDeliveryModeToast("转写完成：用时 1 秒，1 条语段，10 字");
    expect(getToasts()[0]?.actionLabel).toBe("定稿模式…");
    const toasts = getToasts();
    expect(toasts).toHaveLength(1);
    runToastAction(toasts[0].id);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
