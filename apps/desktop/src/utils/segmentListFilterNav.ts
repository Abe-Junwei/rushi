/** 列表筛选快照（由 EditorSegmentList 同步；键盘 ↑↓ 导航真源）。 */
export type SegmentListFilterNavState = {
  active: boolean;
  indices: readonly number[];
  /** Optional O(1) idx→display position; populated by useSegmentListFilter. */
  displayPositionByIndex?: ReadonlyMap<number, number> | null;
  /** Optional visible set; when active, prefer `.has` over `indices.includes`. */
  visibleIndexSet?: ReadonlySet<number> | null;
};

export function createEmptySegmentListFilterNavState(): SegmentListFilterNavState {
  return { active: false, indices: [] };
}

/** 筛选生效且为真子集时返回可见语段 idx；否则 null 表示按全表导航。 */
export function resolveEffectiveFilteredIndices(
  state: SegmentListFilterNavState,
  segmentCount: number,
): readonly number[] | null {
  if (!state.active || state.indices.length === 0) return state.active ? [] : null;
  if (segmentCount > 0 && state.indices.length >= segmentCount) return null;
  return state.indices;
}

/** True when an active filter excludes the given segment index from the list (SC-H6). */
export function isSegmentListFilterHidingPrimary(input: {
  filterActive: boolean;
  filteredIndices: readonly number[];
  primaryIdx: number;
  segmentCount: number;
  visibleIndexSet?: ReadonlySet<number> | null;
}): boolean {
  if (!input.filterActive || input.primaryIdx < 0) return false;
  if (input.visibleIndexSet) {
    if (input.segmentCount > 0 && input.visibleIndexSet.size >= input.segmentCount) {
      return false;
    }
    return !input.visibleIndexSet.has(input.primaryIdx);
  }
  const effective = resolveEffectiveFilteredIndices(
    { active: true, indices: input.filteredIndices },
    input.segmentCount,
  );
  if (effective === null) return false;
  return !effective.includes(input.primaryIdx);
}

/**
 * Keyboard nav reads filterNavRef only — DOM attribute bus removed.
 * Kept for API compatibility; ignores scrollRoot.
 */
export function readSegmentListFilterNavIndices(
  navState: SegmentListFilterNavState,
  segmentCount: number,
  _scrollRoot?: HTMLElement | null,
): readonly number[] | null {
  const fromRef = resolveEffectiveFilteredIndices(navState, segmentCount);
  if (fromRef !== null) return fromRef.length === 0 ? [] : fromRef;
  return null;
}
