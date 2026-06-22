import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";

export type EditorSelectionContextValue = {
  selectedIdx: number;
  selectionLo: number;
  selectionHi: number;
  selectionCount: number;
  isContiguousSelection: boolean;
  isMultiSegmentSelection: boolean;
  selectedIndicesArray: readonly number[];
  isIndexInSelection: (idx: number) => boolean;
  selectSegmentAt: ProjectControllerApi["selectSegmentAt"];
  selectSegmentRange: ProjectControllerApi["selectSegmentRange"];
  selectSegmentIndices: ProjectControllerApi["selectSegmentIndices"];
  clearMultiSelection: ProjectControllerApi["clearMultiSelection"];
};

const EditorSelectionContext = createContext<EditorSelectionContextValue | null>(null);

export function EditorSelectionProvider({
  controller: c,
  children,
}: {
  controller: ProjectControllerApi;
  children: ReactNode;
}) {
  const value = useMemo(
    (): EditorSelectionContextValue => ({
      selectedIdx: c.selectedIdx,
      selectionLo: c.selectionLo,
      selectionHi: c.selectionHi,
      selectionCount: c.selectionCount,
      isContiguousSelection: c.isContiguousSelection,
      isMultiSegmentSelection: c.isMultiSegmentSelection,
      selectedIndicesArray: c.selectedIndicesArray,
      isIndexInSelection: c.isIndexInSelection,
      selectSegmentAt: c.selectSegmentAt,
      selectSegmentRange: c.selectSegmentRange,
      selectSegmentIndices: c.selectSegmentIndices,
      clearMultiSelection: c.clearMultiSelection,
    }),
    [
      c.clearMultiSelection,
      c.isContiguousSelection,
      c.isIndexInSelection,
      c.isMultiSegmentSelection,
      c.selectSegmentAt,
      c.selectSegmentIndices,
      c.selectSegmentRange,
      c.selectedIdx,
      c.selectedIndicesArray,
      c.selectionCount,
      c.selectionHi,
      c.selectionLo,
    ],
  );

  return (
    <EditorSelectionContext.Provider value={value}>{children}</EditorSelectionContext.Provider>
  );
}

export function useEditorSelectionContext(): EditorSelectionContextValue {
  const ctx = useContext(EditorSelectionContext);
  if (!ctx) {
    throw new Error("useEditorSelectionContext requires EditorSelectionProvider");
  }
  return ctx;
}
