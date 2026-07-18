import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  type SegmentContextMenuKey,
  type SegmentContextMenuOpen,
} from "../../utils/segmentContextMenuModel";
import {
  buildSegmentRowContextMenuItems,
  isSegmentTextContextMenuKey,
  parseFontFamilyFromContextMenuKey,
  parseFontSizeFromContextMenuKey,
  type SegmentTextContextMenuKey,
} from "../../utils/segmentTextContextMenuModel";
import type { ContextMenuItem } from "../SegmentContextMenu";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import { getTranscriptEditorView } from "./core/transcriptEditorViewHandle";
import {
  copyTranscriptSelection,
  cutTranscriptSelection,
  pasteTranscriptClipboard,
  readClipboardHasText,
} from "./core/transcriptClipboard";

type TranscriptAppearance = ReturnType<typeof useEditorTranscriptAppearance>;

type Args = {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  segmentCtxMenu: SegmentContextMenuOpen | null;
  appearance: TranscriptAppearance;
  transcriptFontPx: number;
};

export function useEditorViewContextMenu({
  controller: c,
  tx,
  segmentCtxMenu,
  appearance,
  transcriptFontPx,
}: Args) {
  const ctxMenuOpenKey = segmentCtxMenu
    ? `${segmentCtxMenu.x}:${segmentCtxMenu.y}:${segmentCtxMenu.segmentIdx}:${segmentCtxMenu.origin}`
    : null;

  // Paste visibility depends on live clipboard content; probed async per open
  // (defaults to hidden until confirmed, so "粘贴" never shows for an empty clipboard).
  const [clipboardHasText, setClipboardHasText] = useState(false);
  useEffect(() => {
    if (!ctxMenuOpenKey) {
      setClipboardHasText(false);
      return;
    }
    let cancelled = false;
    void readClipboardHasText().then((hasText) => {
      if (!cancelled) setClipboardHasText(hasText);
    });
    return () => {
      cancelled = true;
    };
  }, [ctxMenuOpenKey]);

  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildSegmentRowContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments: c.segments,
            busy: c.busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
            origin: segmentCtxMenu.origin,
            selectionText: segmentCtxMenu.selectionText,
            hasClipboardText: clipboardHasText,
            selectionLo: c.selectionLo,
            selectionHi: c.selectionHi,
            selectionCount: c.selectionCount,
            isContiguousSelection: c.isContiguousSelection,
            selectedIndices: c.selectedIndicesArray,
            appearance: {
              appearanceDisabled: appearance.transcriptFontControlDisabled,
              transcriptFontFamily: appearance.transcriptFontFamily,
              transcriptFontWeight: appearance.transcriptFontWeight,
              transcriptFontItalic: appearance.transcriptFontItalic,
              transcriptFontPx,
              fontOptions: appearance.fontOptions,
              fontDisplayLabels: appearance.fontDisplayLabels,
            },
          })
        : [],
    [
      segmentCtxMenu,
      c.segments,
      c.busy,
      c.selectionCount,
      c.isContiguousSelection,
      c.selectionLo,
      c.selectionHi,
      c.selectedIndicesArray,
      clipboardHasText,
      appearance.transcriptFontControlDisabled,
      appearance.transcriptFontFamily,
      appearance.transcriptFontWeight,
      appearance.transcriptFontItalic,
      appearance.fontOptions,
      appearance.fontDisplayLabels,
      transcriptFontPx,
    ],
  );

  const segmentCtxMenuItemsRef = useRef(segmentCtxMenuItems);
  segmentCtxMenuItemsRef.current = segmentCtxMenuItems;

  const [frozenCtxMenuItems, setFrozenCtxMenuItems] = useState<ContextMenuItem[]>([]);

  useLayoutEffect(() => {
    if (!ctxMenuOpenKey) {
      setFrozenCtxMenuItems([]);
      return;
    }
    // Re-freezes when clipboardHasText resolves after open so 粘贴 can appear
    // without waiting for an unrelated re-open.
    setFrozenCtxMenuItems(segmentCtxMenuItemsRef.current);
  }, [ctxMenuOpenKey, clipboardHasText]);

  const segmentCtxMenuItemsForRender = segmentCtxMenu
    ? frozenCtxMenuItems.length > 0
      ? frozenCtxMenuItems
      : segmentCtxMenuItems
    : [];

  const onSegmentCtxMenuSelect = useCallback(
    (key: string) => {
      if (!segmentCtxMenu) return;

      if (key === "editAnnotation") {
        c.openSegmentAnnotationDialog(segmentCtxMenu.segmentIdx);
        return;
      }

      if (key === "toggleFreeze") {
        // Multi-select: omit idx so controller freezes the full selection set.
        void c.toggleSegmentFrozen(
          c.isMultiSegmentSelection ? undefined : segmentCtxMenu.segmentIdx,
        );
        return;
      }

      if (isSegmentTextContextMenuKey(key)) {
        const actionKey: SegmentTextContextMenuKey = key;
        if (
          actionKey === "copyText" ||
          actionKey === "cutText" ||
          actionKey === "pasteText"
        ) {
          const view = getTranscriptEditorView();
          if (!view || c.busy) return;
          void (async () => {
            if (actionKey === "copyText") await copyTranscriptSelection(view);
            else if (actionKey === "cutText") await cutTranscriptSelection(view);
            else await pasteTranscriptClipboard(view);
          })();
          return;
        }
        if (actionKey === "addCorrectionMemory") {
          c.openManualCorrectionMemoryDialog(segmentCtxMenu.selectionText);
          return;
        }
        if (actionKey === "toggleBold") {
          appearance.setTranscriptFontWeight((weight) => (weight >= 700 ? 500 : 700));
          return;
        }
        if (actionKey === "toggleItalic") {
          appearance.setTranscriptFontItalic((italic) => !italic);
          return;
        }
        const fontSizePx = parseFontSizeFromContextMenuKey(actionKey);
        if (fontSizePx != null) {
          tx.setTranscriptFontPx(fontSizePx);
          return;
        }
        if (actionKey.startsWith("font:")) {
          const family = parseFontFamilyFromContextMenuKey(actionKey as `font:${string}`);
          if (family && family !== "__empty") {
            appearance.setTranscriptFontFamily(appearance.normalizeFontFamily(family));
          }
        }
        return;
      }

      const segmentKey = key as SegmentContextMenuKey;
      const i = segmentCtxMenu.segmentIdx;
      switch (segmentKey) {
        case "delete":
          if (c.isMultiSegmentSelection) {
            if (c.isContiguousSelection) {
              c.requestDeleteSelection(c.selectionLo, c.selectionHi);
            } else {
              c.requestDeleteSelectedIndices(c.selectedIndicesArray);
            }
          } else {
            tx.deleteSegmentAt(i);
          }
          break;
        case "mergePrev":
          c.mergeWithPrevAt(i);
          break;
        case "mergeNext":
          c.mergeWithNextAt(i);
          break;
        case "mergeRange":
          if (c.isContiguousSelection) {
            c.mergeSegmentRange(c.selectionLo, c.selectionHi);
          }
          break;
        case "splitAtPointer":
          tx.splitAtPlayhead(segmentCtxMenu.pointerTimeSec);
          break;
        case "markFirstProof":
          void c.markSegmentFirstProof(i);
          break;
        case "markFinalized":
          void c.markSegmentFinalized(i);
          break;
        default:
          break;
      }
    },
    [appearance, c, segmentCtxMenu, tx],
  );

  return {
    segmentCtxMenuItemsForRender,
    onSegmentCtxMenuSelect,
  };
}
