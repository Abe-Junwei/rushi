import { describe, expect, it } from "vitest";
import {
  isSegmentSnapEnabled,
  readSegmentOverlayModifiers,
  resolveCreateOverlapPolicy,
} from "./segmentOverlayModifiers";

describe("segmentOverlayModifiers", () => {
  it("readSegmentOverlayModifiers mirrors pointer keys", () => {
    expect(readSegmentOverlayModifiers({ altKey: true, shiftKey: false, metaKey: true })).toEqual({
      altKey: true,
      shiftKey: false,
      toggleKey: true,
    });
  });

  it("Alt disables snap", () => {
    expect(isSegmentSnapEnabled({ altKey: false, shiftKey: false, toggleKey: false })).toBe(true);
    expect(isSegmentSnapEnabled({ altKey: true, shiftKey: false, toggleKey: false })).toBe(false);
  });

  it("Shift selects allow overlap policy for box-create", () => {
    expect(resolveCreateOverlapPolicy({ altKey: false, shiftKey: false, toggleKey: false })).toBe("trim");
    expect(resolveCreateOverlapPolicy({ altKey: false, shiftKey: true, toggleKey: false })).toBe("allow");
  });

  it("Alt+Shift selects reject overlap policy for box-create", () => {
    expect(resolveCreateOverlapPolicy({ altKey: true, shiftKey: true, toggleKey: false })).toBe("reject");
    expect(resolveCreateOverlapPolicy({ altKey: true, shiftKey: false, toggleKey: false })).toBe("trim");
  });
});
