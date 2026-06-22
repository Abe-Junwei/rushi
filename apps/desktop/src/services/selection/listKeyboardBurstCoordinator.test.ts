import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  flushListKeyboardKeyupRevealFallback,
  markListKeyboardImperativeScrollKey,
  notifyListKeyboardLayoutSettled,
  pinListKeyboardVirtualDisplayIndex,
  queueListKeyboardKeyupReveal,
  readListKeyboardVirtualDisplayPin,
  registerListKeyboardKeyupRevealHandler,
  registerListKeyboardScrollEpochNotifier,
  resetListKeyboardBurstCoordinatorForTests,
  resetListKeyboardBurstScrollState,
  shouldSkipLayoutScrollForListKeyboard,
} from "./listKeyboardBurstCoordinator";

describe("listKeyboardBurstCoordinator", () => {
  beforeEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resetListKeyboardBurstScrollState clears pin and imperative scroll key", () => {
    pinListKeyboardVirtualDisplayIndex(42);
    markListKeyboardImperativeScrollKey("file:42:42:all");

    resetListKeyboardBurstScrollState();

    expect(readListKeyboardVirtualDisplayPin()).toBeNull();
    expect(shouldSkipLayoutScrollForListKeyboard("file:42:42:all")).toBe(false);
  });

  it("resetListKeyboardBurstScrollState keeps scroll epoch notifier registered", () => {
    const notifier = vi.fn();
    registerListKeyboardScrollEpochNotifier(notifier);
    pinListKeyboardVirtualDisplayIndex(3);

    resetListKeyboardBurstScrollState();

    expect(readListKeyboardVirtualDisplayPin()).toBeNull();
    registerListKeyboardScrollEpochNotifier(notifier);
    notifier({ sync: true, force: true });
    expect(notifier).toHaveBeenCalledWith({ sync: true, force: true });
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
