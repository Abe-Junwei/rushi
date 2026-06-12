/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasOpenDialogEscapeHandler,
  registerDialogEscape,
  resetDialogEscapeStackForTests,
} from "./dialogEscapeStack";

function dispatchEscape(): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("dialogEscapeStack", () => {
  afterEach(() => {
    resetDialogEscapeStackForTests();
  });

  it("closes only the topmost registered dialog", () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();

    const unregisterBottom = registerDialogEscape({ close: closeBottom });
    registerDialogEscape({ close: closeTop });

    dispatchEscape();

    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();

    unregisterBottom();
  });

  it("respects canClose before closing", () => {
    const close = vi.fn();
    registerDialogEscape({ close, canClose: () => false });

    const event = dispatchEscape();

    expect(close).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("stops propagation when closing", () => {
    const close = vi.fn();
    registerDialogEscape({ close });

    const event = dispatchEscape();

    expect(close).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("tracks whether any dialog is registered", () => {
    expect(hasOpenDialogEscapeHandler()).toBe(false);
    const unregister = registerDialogEscape({ close: vi.fn() });
    expect(hasOpenDialogEscapeHandler()).toBe(true);
    unregister();
    expect(hasOpenDialogEscapeHandler()).toBe(false);
  });
});
