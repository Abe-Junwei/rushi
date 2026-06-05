import { describe, expect, it } from "vitest";
import type { BusyReason } from "../pages/useProjectController";
import { busyOverlayCopy } from "./projectStatusFeedbackCopy";

describe("ProjectBusyOverlay transcribe copy (R3t-B)", () => {
  it("shows transcribe-specific title and hint", () => {
    const copy = busyOverlayCopy("transcribe", null);
    expect(copy.title).toContain("自动转录");
    expect(copy.hint).toMatch(/分段处理|语段/);
  });

  it("shows save-specific copy", () => {
    const copy = busyOverlayCopy("save" satisfies BusyReason, null);
    expect(copy.title).toContain("SQLite");
  });
});
