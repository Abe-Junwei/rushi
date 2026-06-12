import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cancelTranscriptSegmentFocusAttempts,
  focusTranscriptSegmentTextarea,
} from "./focusTranscriptSegmentTextarea";

describe("focusTranscriptSegmentTextarea", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelTranscriptSegmentFocusAttempts();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("cancels stale retry when a newer focus request arrives", () => {
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, "focus");

    focusTranscriptSegmentTextarea(null, 0);
    focusTranscriptSegmentTextarea(null, 1);

    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "1");
    const textarea = document.createElement("textarea");
    textarea.className = "seg-text";
    textarea.setAttribute("aria-label", "语段正文");
    row.appendChild(textarea);
    document.body.appendChild(row);

    vi.runAllTimers();
    expect(focus).toHaveBeenCalled();
    focus.mockRestore();
  });

  it("does not scroll by default", () => {
    const root = document.createElement("div");
    root.setAttribute("data-segment-list-scroll", "");
    Object.defineProperty(root, "clientHeight", { value: 400 });
    Object.defineProperty(root, "scrollHeight", { value: 800 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    document.body.appendChild(root);

    focusTranscriptSegmentTextarea(root, 3);
    expect(root.scrollTop).toBe(0);
  });
});
