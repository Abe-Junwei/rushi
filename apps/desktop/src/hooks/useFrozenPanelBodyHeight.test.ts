import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFrozenPanelBodyHeight } from "./useFrozenPanelBodyHeight";

describe("useFrozenPanelBodyHeight", () => {
  it("freezes first measurement until layoutRev changes", () => {
    const { result, rerender } = renderHook(
      ({ bodyHeight, layoutRev }) => useFrozenPanelBodyHeight(bodyHeight, layoutRev, true),
      { initialProps: { bodyHeight: null as number | null, layoutRev: 0 } },
    );

    expect(result.current).toBeNull();

    rerender({ bodyHeight: 280, layoutRev: 0 });
    expect(result.current).toBe(280);

    rerender({ bodyHeight: 300, layoutRev: 0 });
    expect(result.current).toBe(280);

    rerender({ bodyHeight: 320, layoutRev: 1 });
    expect(result.current).toBe(320);
  });

  it("returns null when disabled", () => {
    const { result, rerender } = renderHook(
      ({ bodyHeight, layoutRev }) => useFrozenPanelBodyHeight(bodyHeight, layoutRev, false),
      { initialProps: { bodyHeight: 200 as number | null, layoutRev: 0 } },
    );

    expect(result.current).toBeNull();

    rerender({ bodyHeight: 240, layoutRev: 0 });
    expect(result.current).toBeNull();
  });
});
