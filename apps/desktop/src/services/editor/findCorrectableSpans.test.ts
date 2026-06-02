import { describe, expect, it } from "vitest";
import { findCorrectableSpans } from "./findCorrectableSpans";

describe("findCorrectableSpans", () => {
  it("prefers longer wrong forms and avoids overlap", () => {
    const spans = findCorrectableSpans("城市市场", [
      { wrong: "城市", right: "城镇", hitCount: 2, acceptedAsRule: true },
      { wrong: "市", right: "镇", hitCount: 1, acceptedAsRule: false },
    ]);
    expect(spans).toEqual([{ charStart: 0, charEnd: 2, surface: "城市" }]);
  });

  it("skips rules shorter than two chars", () => {
    const spans = findCorrectableSpans("ab", [{ wrong: "a", right: "b", hitCount: 1, acceptedAsRule: false }]);
    expect(spans).toHaveLength(0);
  });
});
