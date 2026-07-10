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
  children,
}: {
  input: WaveformSelectionChromeReactInput;
  filterActive: boolean;
  filteredIndices: readonly number[];
  children: ReactNode;
}) {
  const view = useWaveformSelectionChromeView(input);
  const filterExcludesPrimary = isSegmentListFilterHidingPrimary({
    filterActive,
    filteredIndices,
    primaryIdx: view.selectedIdx,
    segmentCount: input.segmentCount ?? 0,
  });
  const listVisibleIndexSet = useMemo((): ReadonlySet<number> | null => {
    if (!filterActive) return null;
    return new Set(filteredIndices);
  }, [filterActive, filteredIndices]);
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
