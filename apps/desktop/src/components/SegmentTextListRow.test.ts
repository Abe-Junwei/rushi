import { expectTypeOf } from "vitest";
import { describe, it } from "vitest";
import type { SegmentTextListRowProps } from "./SegmentTextListRow";

describe("SegmentTextListRow T2", () => {
  it("does not expose onRevealSelectedSegment (same-row re-click must not reveal)", () => {
    expectTypeOf<SegmentTextListRowProps>().not.toMatchTypeOf<{ onRevealSelectedSegment: () => void }>();
  });
});
