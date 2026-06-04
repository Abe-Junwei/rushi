import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildFindMatchListItems, clampMatchIndex } from "../services/editor/segmentFindReplace";
import {
  captureTranscriptTextareaSelection,
  readTranscriptTextareaSelection,
} from "../utils/transcriptSelection";
import type {
  FindReplaceControllerApi,
  FindReplaceDialogState,
  UseFindReplaceControllerArgs,
} from "./findReplaceTypes";
import { useFindReplaceMutations } from "./useFindReplaceMutations";
import { useFindReplaceSearch } from "./useFindReplaceSearch";

export type { FindReplaceControllerApi, FindReplaceDialogState } from "./findReplaceTypes";

export function useFindReplaceController(args: UseFindReplaceControllerArgs): FindReplaceControllerApi {
  const {
    busy,
    currentFileId,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSelectedIdx,
    updateSegmentText,
    setSegments,
    pushUndo,
    saveSegments,
  } = args;

  const [dialog, setDialog] = useState<FindReplaceDialogState>({ phase: "closed" });

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const currentFileIdRef = useRef(currentFileId);
  currentFileIdRef.current = currentFileId;
  const canFindReplaceRef = useRef(false);
  const dialogPhaseRef = useRef<FindReplaceDialogState["phase"]>("closed");

  const findReplaceBlockReason = !currentFileId
    ? "请先打开一个文件"
    : busy
      ? "处理中，请稍候"
      : segments.length === 0
        ? "当前文件没有语段"
        : null;

  const canFindReplace = findReplaceBlockReason === null;
  canFindReplaceRef.current = canFindReplace;
  dialogPhaseRef.current = dialog.phase;

  const search = useFindReplaceSearch({
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSelectedIdx,
  });

  const closeFindReplace = useCallback(() => {
    search.clearFindSearchDebounce();
    setDialog({ phase: "closed" });
    search.resetSearchState();
  }, [search]);

  const onRequestReplaceAllPreview = useCallback(
    (rows: Extract<FindReplaceDialogState, { phase: "replaceAllPreview" }>["rows"]) => {
      setDialog({
        phase: "replaceAllPreview",
        findText: search.findText,
        replaceText: search.replaceText,
        rows,
        matchCount: search.matches.length,
      });
    },
    [search.findText, search.matches.length, search.replaceText],
  );

  const mutations = useFindReplaceMutations({
    busy,
    segmentsRef,
    flushSegmentTextDrafts,
    updateSegmentText,
    setSegments,
    pushUndo,
    saveSegments,
    findText: search.findText,
    replaceText: search.replaceText,
    activeMatchIndex: search.activeMatchIndex,
    matches: search.matches,
    applySearchResults: search.applySearchResults,
    closeFindReplace,
    onRequestReplaceAllPreview,
  });

  const openFindReplace = useCallback(
    (initialFind?: string, initialReplace?: string) => {
      if (!canFindReplace) return;
      const seed = initialFind ?? "";
      const repl = initialReplace ?? "";
      setDialog({
        phase: "panel",
        findText: seed,
        replaceText: repl,
        activeMatchIndex: -1,
        matchCount: 0,
        searchCommitted: false,
        resultItems: [],
      });
      search.seedSearchForOpen(seed, repl);
    },
    [canFindReplace, search],
  );

  const setFindReplaceFindText = useCallback(
    (value: string) => {
      search.setFindReplaceFindText(value);
      setDialog((prev) => (prev.phase === "panel" ? { ...prev, findText: value } : prev));
    },
    [search],
  );

  const setFindReplaceReplaceText = useCallback(
    (value: string) => {
      search.setFindReplaceReplaceText(value);
      setDialog((prev) =>
        prev.phase === "panel"
          ? { ...prev, replaceText: value }
          : prev.phase === "replaceAllPreview"
            ? { ...prev, replaceText: value }
            : prev,
      );
    },
    [search],
  );

  const findReplaceCancelReplaceAllPreview = useCallback(() => {
    setDialog({
      phase: "panel",
      findText: search.findText,
      replaceText: search.replaceText,
      activeMatchIndex: clampMatchIndex(search.activeMatchIndex, search.matches.length),
      matchCount: search.matches.length,
      searchCommitted: true,
      resultItems: buildFindMatchListItems(segments, search.matches),
    });
  }, [search.activeMatchIndex, search.findText, search.matches, search.replaceText, segments]);

  useEffect(() => {
    if (dialog.phase !== "panel") return;
    setDialog((prev) => {
      if (prev.phase !== "panel") return prev;
      return {
        ...prev,
        activeMatchIndex: search.activeMatchIndex,
        matchCount: search.matches.length,
        searchCommitted: search.searchCommitted,
        resultItems: search.resultItems,
      };
    });
  }, [
    dialog.phase,
    search.activeMatchIndex,
    search.matches.length,
    search.resultItems,
    search.searchCommitted,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busyRef.current || !currentFileIdRef.current || !canFindReplaceRef.current) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "f" || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (dialogPhaseRef.current === "panel") {
        const sel = captureTranscriptTextareaSelection() || readTranscriptTextareaSelection();
        if (sel) {
          search.clearFindSearchDebounce();
          setFindReplaceFindText(sel);
          search.commitFindSearch(sel, 0);
        }
        search.focusFindInput(Boolean(sel));
        return;
      }
      if (dialogPhaseRef.current !== "closed") return;
      const sel = captureTranscriptTextareaSelection() || readTranscriptTextareaSelection();
      openFindReplace(sel || undefined);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      search.clearFindSearchDebounce();
    };
  }, [
    openFindReplace,
    search.clearFindSearchDebounce,
    search.commitFindSearch,
    search.focusFindInput,
    setFindReplaceFindText,
  ]);

  const findReplaceEditorHighlight = useMemo(() => {
    if (dialog.phase === "closed" || !search.searchCommitted || search.activeMatchIndex < 0) return null;
    const match = search.matches[search.activeMatchIndex];
    if (!match || !search.findText) return null;
    return {
      segmentIdx: match.segmentIdx,
      charStart: match.charStart,
      charEnd: match.charEnd,
    };
  }, [dialog.phase, search.activeMatchIndex, search.findText, search.matches, search.searchCommitted]);

  const findReplaceDialog: FindReplaceDialogState =
    dialog.phase === "closed"
      ? { phase: "closed" }
      : dialog.phase === "replaceAllPreview"
        ? dialog
        : {
            phase: "panel",
            findText: search.findText,
            replaceText: search.replaceText,
            activeMatchIndex: search.activeMatchIndex,
            matchCount: search.matches.length,
            searchCommitted: search.searchCommitted,
            resultItems: search.resultItems,
          };

  return {
    canFindReplace,
    findReplaceBlockReason,
    findReplaceDialog,
    openFindReplace,
    closeFindReplace,
    setFindReplaceFindText,
    setFindReplaceReplaceText,
    findReplaceRunSearch: search.findReplaceRunSearch,
    findReplaceSelectMatch: search.findReplaceSelectMatch,
    findReplaceGoNext: search.findReplaceGoNext,
    findReplaceGoPrev: search.findReplaceGoPrev,
    findReplaceCurrent: mutations.findReplaceCurrent,
    findReplaceReplaceAndNext: mutations.findReplaceReplaceAndNext,
    findReplaceEditorHighlight,
    findReplaceRequestReplaceAll: mutations.findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll: mutations.findReplaceConfirmReplaceAll,
    findReplaceCancelReplaceAllPreview,
  };
}
