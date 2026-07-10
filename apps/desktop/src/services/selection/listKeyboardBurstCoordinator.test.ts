import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  flushListKeyboardKeyupRevealFallback,
  notifyListKeyboardLayoutSettled,
  queueListKeyboardKeyupReveal,
  registerListKeyboardKeyupRevealHandler,
  resetListKeyboardBurstCoordinatorForTests,
} from "./listKeyboardBurstCoordinator";

describe("listKeyboardBurstCoordinator", () => {
  beforeEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers keyup reveal after layout settled with matching scrollKey", () => {
    const handler = vi.fn();
    registerListKeyboardKeyupRevealHandler(handler);
    queueListKeyboardKeyupReveal({ idx: 5, scrollKey: "f1:5:5:all" });

    notifyListKeyboardLayoutSettled("f1:5:5:all");

    expect(handler).toHaveBeenCalledWith(5);
    vi.advanceTimersByTime(64);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores layout settled when scrollKey mismatches", () => {
    const handler = vi.fn();
    registerListKeyboardKeyupRevealHandler(handler);
    queueListKeyboardKeyupReveal({ idx: 5, scrollKey: "f1:5:5:all" });

    notifyListKeyboardLayoutSettled("f1:6:6:all");

    expect(handler).not.toHaveBeenCalled();
    flushListKeyboardKeyupRevealFallback();
    expect(handler).toHaveBeenCalledWith(5);
  });

  it("fallback timer delivers reveal when layout never settles", () => {
    const handler = vi.fn();
    registerListKeyboardKeyupRevealHandler(handler);
    queueListKeyboardKeyupReveal({ idx: 3, scrollKey: "f1:3:3:all" });

    vi.advanceTimersByTime(64);

    expect(handler).toHaveBeenCalledWith(3);
  });
});
