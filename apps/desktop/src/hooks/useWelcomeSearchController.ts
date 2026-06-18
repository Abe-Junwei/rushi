import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import {
  welcomeSearchContent,
  welcomeSearchFiles,
  type WelcomeContentSearchHit,
  type WelcomeFileSearchHit,
} from "../tauri/welcomeSearchApi";
import { scheduleScrollSegmentListIndexToView } from "../utils/segmentListVirtualWindow";
import {
  clearWelcomeSearchEditorHighlight,
  pushRecentSearchQuery,
  readRecentSearchQueries,
  readWelcomeSearchScope,
  setWelcomeSearchEditorHighlight,
  setWelcomeSearchHubFileTarget,
  writeWelcomeSearchScope,
  type WelcomeSearchScope,
} from "../services/welcome/welcomeSearch";
import {
  buildWelcomeSearchNavItems,
  cycleWelcomeSearchScope,
  type WelcomeSearchNavItem,
} from "../services/welcome/welcomeSearchNav";

const SEARCH_DEBOUNCE_MS = 320;

export function useWelcomeSearchController(controller: ProjectControllerApi) {
  const [scope, setScopeState] = useState<WelcomeSearchScope>(() => readWelcomeSearchScope());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileResults, setFileResults] = useState<WelcomeFileSearchHit[]>([]);
  const [contentResults, setContentResults] = useState<WelcomeContentSearchHit[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>(() => readRecentSearchQueries());
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRootRef = useRef<HTMLDivElement | null>(null);

  const setScope = useCallback((next: WelcomeSearchScope) => {
    setScopeState(next);
    writeWelcomeSearchScope(next);
    setActiveIndex(-1);
  }, []);

  const cycleScope = useCallback((direction: 1 | -1) => {
    setScopeState((current) => {
      const next = cycleWelcomeSearchScope(current, direction);
      writeWelcomeSearchScope(next);
      return next;
    });
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, scope, fileResults, contentResults, recentQueries]);

  useEffect(() => {
    const trimmed = debouncedQuery;
    if (!trimmed) {
      setFileResults([]);
      setContentResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [files, content] = await Promise.all([
          welcomeSearchFiles(trimmed),
          welcomeSearchContent(trimmed),
        ]);
        if (!cancelled) {
          setFileResults(files);
          setContentResults(content);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setFileResults([]);
          setContentResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (open) setRecentQueries(readRecentSearchQueries());
  }, [open]);

  const queryEmpty = debouncedQuery.length === 0;

  const navItems = useMemo(
    () =>
      buildWelcomeSearchNavItems({
        queryEmpty,
        recentQueries,
        scope,
        fileResults,
        contentResults,
      }),
    [queryEmpty, recentQueries, scope, fileResults, contentResults],
  );

  const closeSearch = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = searchRootRef.current;
      const target = event.target;
      if (!(target instanceof Node) || root?.contains(target)) return;
      closeSearch();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, closeSearch]);

  const rememberQuery = useCallback((q: string) => {
    pushRecentSearchQuery(q);
    setRecentQueries(readRecentSearchQueries());
  }, []);

  const navigateToFileHub = useCallback(
    async (hit: WelcomeFileSearchHit) => {
      closeSearch();
      setQuery("");
      setDebouncedQuery("");
      rememberQuery(hit.file_name);
      setWelcomeSearchHubFileTarget(hit.file_id);
      await controller.loadProject(hit.project_id);
    },
    [closeSearch, controller, rememberQuery],
  );

  const openFileFromSearch = useCallback(
    async (hit: WelcomeFileSearchHit | WelcomeContentSearchHit) => {
      closeSearch();
      setQuery("");
      setDebouncedQuery("");
      rememberQuery(debouncedQuery || hit.file_name);
      if (controller.current?.id !== hit.project_id) {
        await controller.loadProject(hit.project_id);
      }
      await controller.openFile(hit.file_id);
    },
    [closeSearch, controller, debouncedQuery, rememberQuery],
  );

  const navigateToContentHit = useCallback(
    async (hit: WelcomeContentSearchHit) => {
      closeSearch();
      setQuery("");
      setDebouncedQuery("");
      rememberQuery(debouncedQuery);
      clearWelcomeSearchEditorHighlight();
      setWelcomeSearchEditorHighlight({
        segmentIdx: hit.segment_idx,
        charStart: hit.char_start,
        charEnd: hit.char_end,
      });
      if (controller.current?.id !== hit.project_id) {
        await controller.loadProject(hit.project_id);
      }
      await controller.openFile(hit.file_id);
      controller.setSelectedIdx(hit.segment_idx);
      scheduleScrollSegmentListIndexToView(hit.segment_idx);
      window.setTimeout(() => clearWelcomeSearchEditorHighlight(), 6000);
    },
    [closeSearch, controller, debouncedQuery, rememberQuery],
  );

  const activateNavItem = useCallback(
    (item: WelcomeSearchNavItem) => {
      if (item.type === "recent-query") {
        setQuery(item.query);
        setDebouncedQuery(item.query);
        setActiveIndex(-1);
        return;
      }
      if (item.type === "file") {
        void navigateToFileHub(item.hit);
        return;
      }
      void navigateToContentHit(item.hit);
    },
    [navigateToContentHit, navigateToFileHub],
  );

  const moveActiveIndex = useCallback(
    (delta: number) => {
      if (navItems.length === 0) return;
      setActiveIndex((prev) => {
        if (prev < 0) return delta > 0 ? 0 : navItems.length - 1;
        const next = prev + delta;
        if (next < 0) return navItems.length - 1;
        if (next >= navItems.length) return 0;
        return next;
      });
    },
    [navItems.length],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        closeSearch();
        e.currentTarget.blur();
        return;
      }
      if (e.key === "Tab" && open) {
        e.preventDefault();
        cycleScope(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveIndex(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveIndex(-1);
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0 && navItems[activeIndex]) {
        e.preventDefault();
        activateNavItem(navItems[activeIndex]);
      }
    },
    [activeIndex, activateNavItem, closeSearch, cycleScope, moveActiveIndex, navItems, open],
  );

  return {
    scope,
    setScope,
    cycleScope,
    query,
    setQuery,
    debouncedQuery,
    queryEmpty,
    open,
    setOpen,
    loading,
    error,
    fileResults,
    contentResults,
    recentQueries,
    navItems,
    activeIndex,
    setActiveIndex,
    showPanel: open,
    searchRootRef,
    closeSearch,
    handleInputKeyDown,
    navigateToFileHub,
    openFileFromSearch,
    navigateToContentHit,
    activateNavItem,
  };
}
