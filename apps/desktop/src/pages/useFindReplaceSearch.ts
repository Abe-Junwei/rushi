import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  buildFindMatchListItems,
  clampMatchIndex,
  collectLiteralFindMatches,
  type FindMatch,
} from "../services/editor/segmentFindReplace";

const FIND_SEARCH_DEBOUNCE_MS = 320;

type Args = {
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
};

export function useFindReplaceSearch(args: Args) {
  const { segments, segmentsRef, flushSegmentTextDrafts, setSelectedIdx } = args;

  const [findText, setFindText] = useState("");
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
  }

  const matches: FindMatch[] = useMemo(() => {
    if (!searchCommitted) return [];
    return collectLiteralFindMatches(segments, findText);
  }, [searchCommitted, segments, findText]);

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

  const commitFindSearch = useCallback(
    (query: string, preferredIndex?: number) => {
      if (!query) {
        setSearchCommitted(false);
        setActiveMatchIndex(-1);
        return;
      }
      flushSegmentTextDrafts();
      setSearchCommitted(true);
      const nextMatches = collectLiteralFindMatches(segmentsRef.current, query);
      applySearchResults(nextMatches, preferredIndex);
    },
    [applySearchResults, flushSegmentTextDrafts, segmentsRef],
  );

  const seedSearchForOpen = useCallback(
    (seed: string, repl: string) => {
      clearFindSearchDebounce();
      setFindText(seed);
      setReplaceText(repl);
      setActiveMatchIndex(-1);
      if (seed) commitFindSearch(seed, 0);
      else setSearchCommitted(false);
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
