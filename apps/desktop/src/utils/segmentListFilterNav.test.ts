import { describe, expect, it } from "vitest";
import {
  createEmptySegmentListFilterNavState,
  resolveEffectiveFilteredIndices,
} from "./segmentListFilterNav";

describe("segmentListFilterNav", () => {
  it("treats inactive filter as full list navigation", () => {
    expect(resolveEffectiveFilteredIndices(createEmptySegmentListFilterNavState(), 5)).toBeNull();
  });

  it("returns empty array when filter active but no matches", () => {
    expect(resolveEffectiveFilteredIndices({ active: true, indices: [] }, 5)).toEqual([]);
  });

  it("returns indices when filter is a strict subset", () => {
    expect(resolveEffectiveFilteredIndices({ active: true, indices: [0, 2] }, 5)).toEqual([0, 2]);
  });

  it("returns null when filter includes every segment", () => {
    expect(resolveEffectiveFilteredIndices({ active: true, indices: [0, 1, 2] }, 3)).toBeNull();
  });
});
