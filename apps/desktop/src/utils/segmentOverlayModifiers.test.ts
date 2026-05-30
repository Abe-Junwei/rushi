import { describe, expect, it } from "vitest";
import {
  isSegmentSnapEnabled,
  readSegmentOverlayModifiers,
  resolveCreateOverlapPolicy,
} from "./segmentOverlayModifiers";

describe("segmentOverlayModifiers", () => {
  it("readSegmentOverlayModifiers mirrors pointer keys", () => {
    expect(readSegmentOverlayModifiers({ altKey: true, shiftKey: false })).toEqual({
      altKey: true,
      shiftKey: false,
    });
  });

  it("Alt disables snap", () => {
    expect(isSegmentSnapEnabled({ altKey: false, shiftKey: false })).toBe(true);
    expect(isSegmentSnapEnabled({ altKey: true, shiftKey: false })).toBe(false);
  });

  it("Shift selects allow overlap policy for box-create", () => {
    expect(resolveCreateOverlapPolicy({ altKey: false, shiftKey: false })).toBe("trim");
    expect(resolveCreateOverlapPolicy({ altKey: false, shiftKey: true })).toBe("allow");
  });

  it("Alt+Shift selects reject overlap policy for box-create", () => {
    expect(resolveCreateOverlapPolicy({ altKey: true, shiftKey: true })).toBe("reject");
    expect(resolveCreateOverlapPolicy({ altKey: true, shiftKey: false })).toBe("trim");
  });
});
