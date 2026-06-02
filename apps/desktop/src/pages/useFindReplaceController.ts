import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  applyReplaceAllToSegments,
  buildFindMatchListItems,
  buildReplaceAllPreviewRows,
  clampMatchIndex,
  collectLiteralFindMatches,
  replaceOnceInText,
  type FindMatch,
  type FindMatchListItem,
  type ReplaceAllPreviewRow,
} from "../services/editor/segmentFindReplace";
import {
  captureTranscriptTextareaSelection,
  readTranscriptTextareaSelection,
} from "../utils/transcriptSelection";
import { toast } from "../services/ui/toast";

export type FindReplaceDialogState =
  | { phase: "closed" }
  | {
      phase: "panel";
      findText: string;
      replaceText: string;
      activeMatchIndex: number;
      matchCount: number;
      searchCommitted: boolean;
      resultItems: FindMatchListItem[];
    }
  | {
      phase: "replaceAllPreview";
      findText: string;
      replaceText: string;
      rows: ReplaceAllPreviewRow[];
      matchCount: number;
    };

type UseFindReplaceControllerArgs = {
  busy: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  selectedIdx: number;
  flushSegmentTextDrafts: () => void;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  updateSegmentText: (idx: number, text: string) => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  saveSegments: (options?: { quiet?: boolean }) => Promise<boolean>;
};

export type FindReplaceControllerApi = {
  canFindReplace: boolean;
  findReplaceBlockReason: string | null;
  findReplaceDialog: FindReplaceDialogState;
  openFindReplace: (initialFind?: string, initialReplace?: string) => void;
  findReplaceEditorHighlight: {
    segmentIdx: number;
    charStart: number;
    charEnd: number;
  } | null;
  findReplaceReplaceAndNext: () => void;
  closeFindReplace: () => void;
  setFindReplaceFindText: (value: string) => void;
  setFindReplaceReplaceText: (value: string) => void;
  findReplaceRunSearch: () => void;
  findReplaceSelectMatch: (globalIndex: number) => void;
  findReplaceGoNext: () => void;
  findReplaceGoPrev: () => void;
  findReplaceCurrent: () => void;
  findReplaceRequestReplaceAll: () => void;
  findReplaceConfirmReplaceAll: () => Promise<void>;
  findReplaceCancelReplaceAllPreview: () => void;
};

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
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [searchCommitted, setSearchCommitted] = useState(false);

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const currentFileIdRef = useRef(currentFileId);
  currentFileIdRef.current = currentFileId;
  const canFindReplaceRef = useRef(false);
  const dialogPhaseRef = useRef<FindReplaceDialogState["phase"]>("closed");
  const findSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FIND_SEARCH_DEBOUNCE_MS = 320;

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

  const matches: FindMatch[] = useMemo(() => {
    if (dialog.phase === "closed" || !searchCommitted) return [];
    return collectLiteralFindMatches(segments, findText);
  }, [dialog.phase, searchCommitted, segments, findText]);

  const resultItems = useMemo(
    () => buildFindMatchListItems(segments, matches),
    [matches, segments],
  );

  const focusMatch = useCallback(
    (match: FindMatch | undefined) => {
      if (!match) return;
      setSelectedIdx(match.segmentIdx);
    },
    [setSelectedIdx],
  );

  const applySearchResults = useCallback(
    (nextMatches: FindMatch[], preferredIndex?: number) => {
      if (nextMatches.length === 0) {
        setActiveMatchIndex(-1);
        return;
      }
      const idx =
        preferredIndex != null && preferredIndex >= 0 && preferredIndex < nextMatches.length
          ? preferredIndex
          : clampMatchIndex(0, nextMatches.length);
      setActiveMatchIndex(idx);
      focusMatch(nextMatches[idx]);
    },
    [focusMatch],
  );

  const focusFindInput = useCallback((selectAll = false) => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById("find-replace-find-input");
      if (!(el instanceof HTMLInputElement)) return;
      el.focus();
      if (selectAll) el.select();
    });
  }, []);

  const commitFindSearch = useCallback(
    (query: string, preferredIndex?: number) => {
      if (!query) {
        setSearchCommitted(false);
        setActiveMatchIndex(-1);
        setDialog((prev) =>
          prev.phase === "panel"
            ? {
                ...prev,
                searchCommitted: false,
                matchCount: 0,
                activeMatchIndex: -1,
                resultItems: [],
              }
            : prev,
        );
        return;
      }
      flushSegmentTextDrafts();
      setSearchCommitted(true);
      const nextMatches = collectLiteralFindMatches(segmentsRef.current, query);
      applySearchResults(nextMatches, preferredIndex);
    },
    [applySearchResults, flushSegmentTextDrafts, segmentsRef],
  );

  const runSearchOnCurrentSegments = useCallback(
    (preferredIndex?: number) => {
      commitFindSearch(findText, preferredIndex);
    },
    [commitFindSearch, findText],
  );

  const openFindReplace = useCallback(
    (initialFind?: string, initialReplace?: string) => {
      if (!canFindReplace) return;
      if (findSearchDebounceRef.current !== null) {
        clearTimeout(findSearchDebounceRef.current);
        findSearchDebounceRef.current = null;
      }
      flushSegmentTextDrafts();
      const seed = initialFind ?? "";
      const repl = initialReplace ?? "";
      setFindText(seed);
      setReplaceText(repl);
      setActiveMatchIndex(-1);
      setDialog({
        phase: "panel",
        findText: seed,
        replaceText: repl,
        activeMatchIndex: -1,
        matchCount: 0,
        searchCommitted: false,
        resultItems: [],
      });
      if (seed) commitFindSearch(seed, 0);
      else {
        setSearchCommitted(false);
      }
      focusFindInput(seed.length > 0);
    },
    [canFindReplace, commitFindSearch, flushSegmentTextDrafts, focusFindInput],
  );

  const closeFindReplace = useCallback(() => {
    if (findSearchDebounceRef.current !== null) {
      clearTimeout(findSearchDebounceRef.current);
      findSearchDebounceRef.current = null;
    }
    setDialog({ phase: "closed" });
    setSearchCommitted(false);
  }, []);

  const setFindReplaceFindText = useCallback(
    (value: string) => {
      setFindText(value);
      setDialog((prev) => (prev.phase === "panel" ? { ...prev, findText: value } : prev));

      if (findSearchDebounceRef.current !== null) {
        clearTimeout(findSearchDebounceRef.current);
        findSearchDebounceRef.current = null;
      }

      if (!value) {
        commitFindSearch("");
        return;
      }

      findSearchDebounceRef.current = setTimeout(() => {
        findSearchDebounceRef.current = null;
        commitFindSearch(value, 0);
      }, FIND_SEARCH_DEBOUNCE_MS);
    },
    [commitFindSearch],
  );

  const setFindReplaceReplaceText = useCallback((value: string) => {
    setReplaceText(value);
    setDialog((prev) =>
      prev.phase === "panel" ? { ...prev, replaceText: value } : prev.phase === "replaceAllPreview" ? { ...prev, replaceText: value } : prev,
    );
  }, []);

  const findReplaceRunSearch = useCallback(() => {
    if (!canFindReplace) return;
    if (findSearchDebounceRef.current !== null) {
      clearTimeout(findSearchDebounceRef.current);
      findSearchDebounceRef.current = null;
    }
    flushSegmentTextDrafts();
    runSearchOnCurrentSegments(0);
  }, [canFindReplace, flushSegmentTextDrafts, runSearchOnCurrentSegments]);

  const findReplaceSelectMatch = useCallback(
    (globalIndex: number) => {
      if (!searchCommitted) return;
      const idx = matches.findIndex((m) => m.globalIndex === globalIndex);
      if (idx < 0) return;
      setActiveMatchIndex(idx);
      focusMatch(matches[idx]);
    },
    [focusMatch, matches, searchCommitted],
  );

  const findReplaceGoNext = useCallback(() => {
    if (!matches.length) return;
    const next = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(next);
    focusMatch(matches[next]);
  }, [activeMatchIndex, focusMatch, matches]);

  const findReplaceGoPrev = useCallback(() => {
    if (!matches.length) return;
    const next = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(next);
    focusMatch(matches[next]);
  }, [activeMatchIndex, focusMatch, matches]);

  const findReplaceCurrent = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const match = matches[activeMatchIndex];
    if (!match) return;
    flushSegmentTextDrafts();
    const row = segmentsRef.current[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText === row.text) return;
    updateSegmentText(match.segmentIdx, nextText);
    const projected = segmentsRef.current.map((s, i) =>
      i === match.segmentIdx ? { ...s, text: nextText } : s,
    );
    const nextMatches = collectLiteralFindMatches(projected, findText);
    const nextActive = clampMatchIndex(
      Math.min(activeMatchIndex, Math.max(0, nextMatches.length - 1)),
      nextMatches.length,
    );
    applySearchResults(nextMatches, nextActive >= 0 ? nextActive : undefined);
  }, [
    activeMatchIndex,
    applySearchResults,
    findText,
    flushSegmentTextDrafts,
    matches,
    replaceText,
    segmentsRef,
    updateSegmentText,
  ]);

  const findReplaceReplaceAndNext = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const match = matches[activeMatchIndex];
    if (!match) return;
    flushSegmentTextDrafts();
    const row = segmentsRef.current[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText !== row.text) {
      updateSegmentText(match.segmentIdx, nextText);
    }
    const projected = segmentsRef.current.map((s, i) =>
      i === match.segmentIdx ? { ...s, text: nextText } : s,
    );
    const nextMatches = collectLiteralFindMatches(projected, findText);
    if (!nextMatches.length) {
      setActiveMatchIndex(-1);
      return;
    }
    const next = (activeMatchIndex + 1) % nextMatches.length;
    applySearchResults(nextMatches, next);
  }, [
    activeMatchIndex,
    applySearchResults,
    findText,
    flushSegmentTextDrafts,
    matches,
    replaceText,
    segmentsRef,
    updateSegmentText,
  ]);

  const findReplaceRequestReplaceAll = useCallback(() => {
    if (!findText || !matches.length) return;
    flushSegmentTextDrafts();
    const rows = buildReplaceAllPreviewRows(segmentsRef.current, findText, replaceText, matches);
    setDialog({
      phase: "replaceAllPreview",
      findText,
      replaceText,
      rows,
      matchCount: matches.length,
    });
  }, [findText, flushSegmentTextDrafts, matches, replaceText, segmentsRef]);

  const findReplaceConfirmReplaceAll = useCallback(async () => {
    if (!findText || !matches.length || busy) return;
    const matchCount = matches.length;
    flushSegmentTextDrafts();
    pushUndo();
    const next = applyReplaceAllToSegments(segmentsRef.current, findText, replaceText, matches);
    segmentsRef.current = next;
    setSegments(next);
    const saved = await saveSegments({ quiet: true });
    if (!saved) {
      toast.warning("已全部替换，但保存失败，请稍后手动保存以写入纠错记忆");
      return;
    }
    closeFindReplace();
    if (findText !== replaceText) {
      toast.success(`已替换 ${matchCount} 处并已保存；纠错记忆将在符合条件时学习`);
    } else {
      toast.info(`已处理 ${matchCount} 处并已保存`);
    }
  }, [
    busy,
    closeFindReplace,
    findText,
    flushSegmentTextDrafts,
    matches,
    pushUndo,
    replaceText,
    saveSegments,
    segmentsRef,
    setSegments,
  ]);

  const findReplaceCancelReplaceAllPreview = useCallback(() => {
    setDialog({
      phase: "panel",
      findText,
      replaceText,
      activeMatchIndex: clampMatchIndex(activeMatchIndex, matches.length),
      matchCount: matches.length,
      searchCommitted: true,
      resultItems: buildFindMatchListItems(segments, matches),
    });
  }, [activeMatchIndex, findText, matches, replaceText, segments]);

  useEffect(() => {
    if (dialog.phase !== "panel") return;
    setDialog((prev) => {
      if (prev.phase !== "panel") return prev;
      return {
        ...prev,
        activeMatchIndex,
        matchCount: matches.length,
        searchCommitted,
        resultItems,
      };
    });
  }, [activeMatchIndex, dialog.phase, matches.length, resultItems, searchCommitted]);

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
          if (findSearchDebounceRef.current !== null) {
            clearTimeout(findSearchDebounceRef.current);
            findSearchDebounceRef.current = null;
          }
          setFindText(sel);
          setDialog((prev) => (prev.phase === "panel" ? { ...prev, findText: sel } : prev));
          commitFindSearch(sel, 0);
        }
        focusFindInput(Boolean(sel));
        return;
      }
      if (dialogPhaseRef.current !== "closed") return;
      const sel = captureTranscriptTextareaSelection() || readTranscriptTextareaSelection();
      openFindReplace(sel || undefined);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (findSearchDebounceRef.current !== null) {
        clearTimeout(findSearchDebounceRef.current);
      }
    };
  }, [commitFindSearch, focusFindInput, openFindReplace]);

  const findReplaceEditorHighlight = useMemo(() => {
    if (dialog.phase === "closed" || !searchCommitted || activeMatchIndex < 0) return null;
    const match = matches[activeMatchIndex];
    if (!match || !findText) return null;
    return {
      segmentIdx: match.segmentIdx,
      charStart: match.charStart,
      charEnd: match.charEnd,
    };
  }, [activeMatchIndex, dialog.phase, findText, matches, searchCommitted]);

  const findReplaceDialog: FindReplaceDialogState =
    dialog.phase === "closed"
      ? { phase: "closed" }
      : dialog.phase === "replaceAllPreview"
        ? dialog
        : {
            phase: "panel",
            findText,
            replaceText,
            activeMatchIndex,
            matchCount: matches.length,
            searchCommitted,
            resultItems,
          };

  return {
    canFindReplace,
    findReplaceBlockReason,
    findReplaceDialog,
    openFindReplace,
    closeFindReplace,
    setFindReplaceFindText,
    setFindReplaceReplaceText,
    findReplaceRunSearch,
    findReplaceSelectMatch,
    findReplaceGoNext,
    findReplaceGoPrev,
    findReplaceCurrent,
    findReplaceReplaceAndNext,
    findReplaceEditorHighlight,
    findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll,
    findReplaceCancelReplaceAllPreview,
  };
}
