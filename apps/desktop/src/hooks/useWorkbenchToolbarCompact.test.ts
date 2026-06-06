import { describe, expect, it } from "vitest";
import {
  WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX,
  workbenchToolbarCompactMediaQuery,
} from "./useWorkbenchToolbarCompact";

describe("useWorkbenchToolbarCompact", () => {
  it("uses max-width 1023px media query for compact layout", () => {
    expect(WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX).toBe(1024);
    expect(workbenchToolbarCompactMediaQuery()).toBe("(max-width: 1023px)");
  });
});
