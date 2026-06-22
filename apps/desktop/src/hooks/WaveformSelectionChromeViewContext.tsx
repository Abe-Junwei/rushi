import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isSegmentListFilterHidingPrimary } from "../utils/segmentListFilterNav";
import type { WaveformSelectionChromeReactInput } from "../services/selection/resolveWaveformSelectionChromeView";
import { resolveWaveformSelectionChromeView } from "../services/selection/resolveWaveformSelectionChromeView";
import { useWaveformSelectionChromeView } from "./useWaveformSelectionChromeView";

export type WaveformSelectionChromeViewContextValue = {
  view: ReturnType<typeof useWaveformSelectionChromeView>;
  filterExcludesPrimary: boolean;
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
  const preFilterView = useWaveformSelectionChromeView(input);
  const filterExcludesPrimary = isSegmentListFilterHidingPrimary({
    filterActive,
    filteredIndices,
    primaryIdx: preFilterView.selectedIdx,
    segmentCount: input.segmentCount ?? 0,
  });
  const value = useMemo((): WaveformSelectionChromeViewContextValue => {
    const view = filterExcludesPrimary
      ? resolveWaveformSelectionChromeView({ ...input, filterExcludesPrimary: true })
      : preFilterView;
    return { view, filterExcludesPrimary };
  }, [filterExcludesPrimary, input, preFilterView]);
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

