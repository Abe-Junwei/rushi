import {
  querySegmentListScrollRoot,
  readSegmentListFilterIndices,
} from "./segmentListVirtualWindow";

/** 列表筛选快照（由 EditorSegmentList 同步；键盘 ↑↓ 导航真源）。 */
export type SegmentListFilterNavState = {
  active: boolean;
  indices: readonly number[];
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

export function readSegmentListFilterNavIndices(
  navState: SegmentListFilterNavState,
  segmentCount: number,
  scrollRoot: HTMLElement | null = querySegmentListScrollRoot(),
): readonly number[] | null {
  const fromRef = resolveEffectiveFilteredIndices(navState, segmentCount);
  if (fromRef !== null) return fromRef.length === 0 ? [] : fromRef;

  const fromDom = readSegmentListFilterIndices(scrollRoot);
  if (!fromDom) return null;
  if (segmentCount > 0 && fromDom.length >= segmentCount) return null;
  return fromDom;
}
