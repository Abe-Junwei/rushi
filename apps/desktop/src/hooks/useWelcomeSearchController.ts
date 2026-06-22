import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import {
  clearWelcomeSearchEditorHighlight,
  readWelcomeSearchScope,
  setWelcomeSearchEditorHighlight,
  setWelcomeSearchHubFileTarget,
  writeWelcomeSearchScope,
  type WelcomeSearchScope,
} from "../services/welcome/welcomeSearch";
import { cycleWelcomeSearchScope } from "../services/welcome/welcomeSearchNav";
import { scheduleScrollSegmentListIndexToView } from "../utils/segmentListVirtualWindow";
import { useWelcomeSearchNavigation } from "./useWelcomeSearchNavigation";
import { useWelcomeSearchQuery } from "./useWelcomeSearchQuery";
import { useWelcomeSearchRecentQueries } from "./useWelcomeSearchRecentQueries";

export function useWelcomeSearchController(controller: ProjectControllerApi) {
  const [scope, setScopeState] = useState<WelcomeSearchScope>(() => readWelcomeSearchScope());
  const [open, setOpen] = useState(false);
  const searchRootRef = useRef<HTMLDivElement | null>(null);

  const {
    query,
    setQuery,
    debouncedQuery,
    queryEmpty,
    loading,
    error,
    fileResults,
    contentResults,
    resetQuery,
  } = useWelcomeSearchQuery();

  const { recentQueries, rememberQuery } = useWelcomeSearchRecentQueries(open);

  const { navItems, activeIndex, setActiveIndex, moveActiveIndex, resetActiveIndex } =
    useWelcomeSearchNavigation({
      queryEmpty,
      recentQueries,
      scope,
      fileResults,
      contentResults,
    });

  const setScope = useCallback(
    (next: WelcomeSearchScope) => {
      setScopeState(next);
      writeWelcomeSearchScope(next);
      resetActiveIndex();
    },
    [resetActiveIndex],
  );

  const cycleScope = useCallback(
    (direction: 1 | -1) => {
      setScopeState((current) => {
        const next = cycleWelcomeSearchScope(current, direction);
        writeWelcomeSearchScope(next);
        return next;
      });
      resetActiveIndex();
    },
    [resetActiveIndex],
  );

  const closeSearch = useCallback(() => {
    setOpen(false);
    resetActiveIndex();
  }, [resetActiveIndex]);

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

  const navigateToFileHub = useCallback(
    async (hit: import("../tauri/welcomeSearchApi").WelcomeFileSearchHit) => {
      closeSearch();
      resetQuery();
      rememberQuery(hit.file_name);
      setWelcomeSearchHubFileTarget(hit.file_id);
      await controller.loadProject(hit.project_id);
    },
    [closeSearch, controller, rememberQuery, resetQuery],
  );

  const openFileFromSearch = useCallback(
    async (
      hit:
        | import("../tauri/welcomeSearchApi").WelcomeFileSearchHit
        | import("../tauri/welcomeSearchApi").WelcomeContentSearchHit,
    ) => {
      closeSearch();
      resetQuery();
      rememberQuery(debouncedQuery || hit.file_name);
      await controller.openWorkspaceFile(hit.project_id, hit.file_id);
    },
    [closeSearch, controller, debouncedQuery, rememberQuery, resetQuery],
  );

  const navigateToContentHit = useCallback(
    async (hit: import("../tauri/welcomeSearchApi").WelcomeContentSearchHit) => {
      closeSearch();
      resetQuery();
      rememberQuery(debouncedQuery);
      clearWelcomeSearchEditorHighlight();
      setWelcomeSearchEditorHighlight({
        segmentIdx: hit.segment_idx,
        charStart: hit.char_start,
        charEnd: hit.char_end,
      });
      await controller.openWorkspaceFile(hit.project_id, hit.file_id);
      controller.setSelectedIdx(hit.segment_idx);
      scheduleScrollSegmentListIndexToView(hit.segment_idx);
      window.setTimeout(() => clearWelcomeSearchEditorHighlight(), 6000);
    },
    [closeSearch, controller, debouncedQuery, rememberQuery, resetQuery],
  );

  const activateNavItem = useCallback(
    (item: import("../services/welcome/welcomeSearchNav").WelcomeSearchNavItem) => {
      if (item.type === "recent-query") {
        setQuery(item.query);
        resetActiveIndex();
        return;
      }
      if (item.type === "file") {
        void navigateToFileHub(item.hit);
        return;
      }
      void navigateToContentHit(item.hit);
    },
    [navigateToContentHit, navigateToFileHub, resetActiveIndex, setQuery],
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
