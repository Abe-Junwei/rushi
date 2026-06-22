// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { computeSelectionProfileSyncPathMs } from "../services/ui/selectionLatencyProfile";

describe("publishSelectionChrome call stack probe", () => {
  it("documents profile syncPathTotal avoids nested span double-count", () => {
    const spans = {
      flushSelectedIdx: 119,
      firstPaint: 100,
      listChrome: 100,
      listScroll: 18,
      seek: 1,
      focus: 2,
    };
    const syncPathTotal = computeSelectionProfileSyncPathMs(spans);
    expect(syncPathTotal).toBe(122);
    expect(syncPathTotal).toBeLessThan(spans.flushSelectedIdx * 1.5);
  });
});
