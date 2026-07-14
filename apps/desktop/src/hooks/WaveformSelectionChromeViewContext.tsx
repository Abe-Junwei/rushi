import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isSegmentListFilterHidingPrimary } from "../utils/segmentListFilterNav";
import type { WaveformSelectionChromeReactInput } from "../services/selection/resolveWaveformSelectionChromeView";
import { useWaveformSelectionChromeView } from "./useWaveformSelectionChromeView";

export type WaveformSelectionChromeViewContextValue = {
  view: ReturnType<typeof useWaveformSelectionChromeView>;
  filterExcludesPrimary: boolean;
  filterActive: boolean;
  /** When filter is active, indices visible in the list; null means paint all bands. */
  listVisibleIndexSet: ReadonlySet<number> | null;
};

const WaveformSelectionChromeViewContext =
  createContext<WaveformSelectionChromeViewContextValue | null>(null);

export function WaveformSelectionChromeViewProvider({
  input,
  filterActive,
  filteredIndices,
  visibleIndexSet,
  children,
}: {
  input: WaveformSelectionChromeReactInput;
  filterActive: boolean;
  filteredIndices: readonly number[];
  /** Prefer shared projection from useSegmentListFilter when provided. */
  visibleIndexSet?: ReadonlySet<number> | null;
  children: ReactNode;
}) {
  const view = useWaveformSelectionChromeView(input);
  const listVisibleIndexSet = useMemo((): ReadonlySet<number> | null => {
    if (visibleIndexSet !== undefined) return visibleIndexSet;
    if (!filterActive) return null;
    return new Set(filteredIndices);
  }, [filterActive, filteredIndices, visibleIndexSet]);
  const filterExcludesPrimary = isSegmentListFilterHidingPrimary({
    filterActive,
    filteredIndices,
    primaryIdx: view.selectedIdx,
    segmentCount: input.segmentCount ?? 0,
    visibleIndexSet: listVisibleIndexSet,
  });
  const value = useMemo(
    (): WaveformSelectionChromeViewContextValue => ({
      view,
      filterExcludesPrimary,
      filterActive,
      listVisibleIndexSet,
    }),
    [view, filterExcludesPrimary, filterActive, listVisibleIndexSet],
  );
  return (
    <WaveformSelectionChromeViewContext.Provider value={value}>
      {children}
    </WaveformSelectionChromeViewContext.Provider>
  );
}

export function useWaveformSelectionChromeViewContext(): WaveformSelectionChromeViewContextValue {
  const ctx = useContext(WaveformSelectionChromeViewContext);
  if (!ctx) {
    throw new Error("useWaveformSelectionChromeViewContext requires WaveformSelectionChromeViewProvider");
  }
  return ctx;
}

/** Safe for hooks that also run in unit tests without the provider. */
export function useOptionalWaveformListVisibleIndexSet(): ReadonlySet<number> | null {
  return useContext(WaveformSelectionChromeViewContext)?.listVisibleIndexSet ?? null;
}

export function useOptionalWaveformFilterExcludesPrimary(): boolean {
  return useContext(WaveformSelectionChromeViewContext)?.filterExcludesPrimary ?? false;
}
