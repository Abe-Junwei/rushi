import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  buildFindMatchListItems,
  clampMatchIndex,
  collectLiteralFindMatches,
  type FindMatch,
} from "../services/editor/segmentFindReplace";
import { scheduleScrollSegmentListIndexToView } from "../utils/segmentListVirtualWindow";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import { dispatchTranscriptFocusFindMatch } from "../components/editor/core/transcriptEditorViewHandle";

const FIND_SEARCH_DEBOUNCE_MS = 320;

type Args = {
  segments: SegmentDto[];
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  flushSegmentTextDrafts: () => void;
  setSelectedIdx: (idx: number) => void;
};

export function useFindReplaceSearch(args: Args) {
  const { segments, getCurrentSegmentsSnapshot, flushSegmentTextDrafts, setSelectedIdx } = args;

  /** 输入框草稿；每键更新，不驱动全量匹配扫描。 */
  const [findText, setFindText] = useState("");
  /** 已提交查询；仅 debounce / 显式查找后更新，驱动 matches / 列表。 */
  const [committedFindQuery, setCommittedFindQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [searchCommitted, setSearchCommitted] = useState(false);
  const findSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearFindSearchDebounce() {
    if (findSearchDebounceRef.current !== null) {
      clearTimeout(findSearchDebounceRef.current);
      findSearchDebounceRef.current = null;
    }
  }

  function focusFindInput(selectAll = false) {
    window.requestAnimationFrame(() => {
      const el = document.getElementById("find-replace-find-input");
      if (!(el instanceof HTMLInputElement)) return;
      el.focus();
      if (selectAll) el.select();
    });
  }

  function resetSearchState() {
    clearFindSearchDebounce();
    setSearchCommitted(false);
    setCommittedFindQuery("");
  }

  const matches: FindMatch[] = useMemo(() => {
    if (!searchCommitted || !committedFindQuery) return [];
    return collectLiteralFindMatches(segments, committedFindQuery);
  }, [searchCommitted, segments, committedFindQuery]);

  const resultItems = useMemo(
    () => buildFindMatchListItems(segments, matches),
    [matches, segments],
  );

  // Matches can shrink when segments change out-of-band (e.g. a match segment is
  // frozen mid-search); keep the active index inside bounds so the highlight and
  // "n / total" label stay valid.
  useEffect(() => {
    setActiveMatchIndex((prev) => {
      if (prev < 0) return prev;
      if (matches.length === 0) return -1;
      if (prev >= matches.length) return matches.length - 1;
      return prev;
    });
  }, [matches.length]);

  const scrollToMatchSegment = useCallback((segmentIdx: number) => {
    scheduleScrollSegmentListIndexToView(segmentIdx);
  }, []);

  const focusMatch = useCallback(
    (match: FindMatch | undefined) => {
      if (!match) return;
      setSelectedIdx(match.segmentIdx);
      if (
        readTranscriptEditorCoreEnabled() &&
        dispatchTranscriptFocusFindMatch(match.segmentIdx, match.charStart, match.charEnd)
      ) {
        return;
      }
      scrollToMatchSegment(match.segmentIdx);
    },
    [scrollToMatchSegment, setSelectedIdx],
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

  const commitFindSearch = useCallback(
    (query: string, preferredIndex?: number) => {
      if (!query) {
        setSearchCommitted(false);
        setCommittedFindQuery("");
        setActiveMatchIndex(-1);
        return;
      }
      flushSegmentTextDrafts();
      setCommittedFindQuery(query);
      setSearchCommitted(true);
      const nextMatches = collectLiteralFindMatches(getCurrentSegmentsSnapshot(), query);
      applySearchResults(nextMatches, preferredIndex);
    },
    [applySearchResults, flushSegmentTextDrafts, getCurrentSegmentsSnapshot],
  );

  const seedSearchForOpen = useCallback(
    (seed: string, repl: string) => {
      clearFindSearchDebounce();
      setFindText(seed);
      setReplaceText(repl);
      setActiveMatchIndex(-1);
      if (seed) commitFindSearch(seed, 0);
      else {
        setSearchCommitted(false);
        setCommittedFindQuery("");
      }
      focusFindInput(seed.length > 0);
    },
    [commitFindSearch],
  );

  const setFindReplaceFindText = useCallback(
    (value: string) => {
      setFindText(value);
      clearFindSearchDebounce();
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

  const setFindReplaceReplaceText = (value: string) => {
    setReplaceText(value);
  };

  const findReplaceRunSearch = useCallback(() => {
    clearFindSearchDebounce();
    flushSegmentTextDrafts();
    commitFindSearch(findText, 0);
  }, [commitFindSearch, findText, flushSegmentTextDrafts]);

  function findReplaceSelectMatch(globalIndex: number) {
    if (!searchCommitted) return;
    const idx = matches.findIndex((m) => m.globalIndex === globalIndex);
    if (idx < 0) return;
    setActiveMatchIndex(idx);
    focusMatch(matches[idx]);
  }

  function findReplaceGoNext() {
    if (!matches.length) return;
    const next = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(next);
    focusMatch(matches[next]);
  }

  function findReplaceGoPrev() {
    if (!matches.length) return;
    const next = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(next);
    focusMatch(matches[next]);
  }

  return {
    findText,
    /** 与 matches 对齐的已提交查询；替换写回须用此值，勿用输入草稿。 */
    committedFindQuery,
    replaceText,
    activeMatchIndex,
    searchCommitted,
    matches,
    resultItems,
    findSearchDebounceRef,
    commitFindSearch,
    applySearchResults,
    focusFindInput,
    clearFindSearchDebounce,
    resetSearchState,
    seedSearchForOpen,
    setFindReplaceFindText,
    setFindReplaceReplaceText,
    findReplaceRunSearch,
    findReplaceSelectMatch,
    findReplaceGoNext,
    findReplaceGoPrev,
  };
}
