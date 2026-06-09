import { describe, expect, it } from "vitest";
import {
  isWorkbenchToolbarCompactWidth,
  WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX,
  workbenchToolbarCompactMediaQuery,
} from "./useWorkbenchToolbarCompact";

describe("useWorkbenchToolbarCompact", () => {
  it("uses max-width 1023px media query for viewport fallback", () => {
    expect(WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX).toBe(1024);
    expect(workbenchToolbarCompactMediaQuery()).toBe("(max-width: 1023px)");
  });

  it("compact when measured track width is below breakpoint", () => {
    expect(isWorkbenchToolbarCompactWidth(1023)).toBe(true);
    expect(isWorkbenchToolbarCompactWidth(1024)).toBe(false);
    expect(isWorkbenchToolbarCompactWidth(900)).toBe(true);
    expect(isWorkbenchToolbarCompactWidth(0)).toBe(false);
  });
});
