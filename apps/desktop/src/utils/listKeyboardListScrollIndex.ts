export function resolveListScrollDisplayIndex(
  segmentIdx: number,
  filterActive: boolean,
  filteredIndices: readonly number[],
  displayCount: number,
): number {
  if (segmentIdx < 0) return -1;
  if (filterActive) return filteredIndices.indexOf(segmentIdx);
  return segmentIdx < displayCount ? segmentIdx : -1;
}

export function buildListKeyboardScrollKey(input: {
  fileId: string | null;
  selectedIdx: number;
  selectedDisplayIndex: number;
  filteredIndicesScrollKey: string;
}): string {
  return `${input.fileId ?? ""}:${input.selectedIdx}:${input.selectedDisplayIndex}:${input.filteredIndicesScrollKey}`;
}

export function buildFilteredIndicesScrollKey(input: {
  filterActive: boolean;
  displayCount: number;
  filteredIndices: readonly number[];
}): string {
  const first = input.filteredIndices[0] ?? -1;
  const last = input.filteredIndices[input.filteredIndices.length - 1] ?? -1;
  return `${input.filterActive ? "filtered" : "all"}:${input.displayCount}:${first}:${last}`;
}

export type ListKeyboardScrollMeta = {
  selectedDisplayIndex: number;
  scrollKey: string;
  rowMinHeightPx: number;
  itemStridePx: number;
  useVirtualList: boolean;
};

export function resolveListKeyboardScrollMeta(input: {
  idx: number;
  fileId: string | null;
  segmentCount: number;
  filterActive: boolean;
  filteredIndices: readonly number[];
  transcriptRowHeightPx: number;
  virtualizeMinCount: number;
  rowMinHeightPx: (transcriptRowHeightPx: number) => number;
  itemStridePx: (rowMinHeightPx: number) => number;
}): ListKeyboardScrollMeta | null {
  const displayCount = input.filterActive ? input.filteredIndices.length : input.segmentCount;
  const selectedDisplayIndex = resolveListScrollDisplayIndex(
    input.idx,
    input.filterActive,
    input.filteredIndices,
    displayCount,
  );
  if (selectedDisplayIndex < 0) return null;

  const rowMinHeightPx = input.rowMinHeightPx(input.transcriptRowHeightPx);
  const itemStridePx = input.itemStridePx(rowMinHeightPx);
  const useVirtualList = displayCount >= input.virtualizeMinCount;
  const filteredIndicesScrollKey = buildFilteredIndicesScrollKey({
    filterActive: input.filterActive,
    displayCount,
    filteredIndices: input.filteredIndices,
  });
  const scrollKey = buildListKeyboardScrollKey({
    fileId: input.fileId,
    selectedIdx: input.idx,
    selectedDisplayIndex,
    filteredIndicesScrollKey,
  });

  return {
    selectedDisplayIndex,
    scrollKey,
    rowMinHeightPx,
    itemStridePx,
    useVirtualList,
  };
}
