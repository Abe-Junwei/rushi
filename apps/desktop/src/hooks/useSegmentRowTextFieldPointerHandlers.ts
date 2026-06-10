import { useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import {
  resolveSegmentTextContextMenuAction,
  type SegmentTextContextMenuSelectionSnapshot,
} from "../utils/segmentTextContextMenuSelection";
import { blurActiveTranscriptTextarea } from "../utils/transcriptSelection";

export function useSegmentRowTextFieldPointerHandlers(input: {
  busy: boolean;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
}) {
  const { busy, onSegmentRowHeightPointerDown, onOpenTextContextMenu } = input;
  const preContextMenuSelectionRef = useRef<SegmentTextContextMenuSelectionSnapshot | null>(null);

  const openTextContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>, selectionText: string) => {
      if (busy || !onOpenTextContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      blurActiveTranscriptTextarea();
      onOpenTextContextMenu(e, selectionText);
    },
    [busy, onOpenTextContextMenu],
  );

  const onTextPointerDownCapture = useCallback((e: PointerEvent<HTMLTextAreaElement>) => {
    if (e.button !== 2) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    preContextMenuSelectionRef.current = {
      start,
      end,
      collapsed: start === end,
    };
  }, []);

  const onTextContextMenu = useCallback(
    (e: MouseEvent<HTMLTextAreaElement>) => {
      if (busy) return;
      const el = e.currentTarget;
      const snapshot = preContextMenuSelectionRef.current;
      preContextMenuSelectionRef.current = null;

      const action = resolveSegmentTextContextMenuAction({
        snapshot,
        value: el.value,
      });

      openTextContextMenu(e, action.selectionText);
    },
    [busy, openTextContextMenu],
  );

  const onStaticTextContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (busy) return;
      openTextContextMenu(e, "");
    },
    [busy, openTextContextMenu],
  );

  const onRowHeightHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSegmentRowHeightPointerDown) return;
      e.stopPropagation();
      onSegmentRowHeightPointerDown(e);
    },
    [onSegmentRowHeightPointerDown],
  );

  return {
    onTextPointerDownCapture,
    onTextContextMenu,
    onStaticTextContextMenu,
    onRowHeightHandlePointerDown,
    canResizeRowHeight: Boolean(onSegmentRowHeightPointerDown) && !busy,
  };
}

export function useSegmentRowTextFieldKeyHandler(
  index: number,
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void,
) {
  return useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(index, e);
    },
    [index, onTextareaKeyDown],
  );
}
