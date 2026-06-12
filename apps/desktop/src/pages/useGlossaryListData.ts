import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sortGlossaryTerms, type GlossaryListSortMode } from "../services/glossaryListSort";
import {
  applyGlossaryFilters,
  countHotwordEnabledTerms,
  type GlossaryHotwordFilter,
} from "../services/glossaryTermHelpers";
import {
  parseGlossaryHotwordsPreview,
  type GlossaryHotwordsPreview,
} from "../services/glossaryHotwords";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";
import { GLOSSARY_LIST_DISPLAY_CAP } from "./glossaryListCap";

export function useGlossaryListData() {
  const [terms, setTerms] = useState<GlossaryTermDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hotwordFilter, setHotwordFilter] = useState<GlossaryHotwordFilter>("all");
  const [sortMode, setSortMode] = useState<GlossaryListSortMode>("updated");
  const [hotwordsPreview, setHotwordsPreview] = useState<GlossaryHotwordsPreview | null>(null);
  const [hotwordsPreviewLoaded, setHotwordsPreviewLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const filteredTerms = useMemo(() => {
    const filtered = applyGlossaryFilters(terms, searchQuery, hotwordFilter);
    return sortGlossaryTerms(filtered, sortMode);
  }, [terms, searchQuery, hotwordFilter, sortMode]);

  const visibleTerms = useMemo(
    () => filteredTerms.slice(0, GLOSSARY_LIST_DISPLAY_CAP),
    [filteredTerms],
  );

  const visibleIds = useMemo(() => visibleTerms.map((row) => row.id), [visibleTerms]);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const hotwordEnabledCount = useMemo(() => countHotwordEnabledTerms(terms), [terms]);

  const refresh = useCallback(async (query?: string) => {
    setLoadError("");
    try {
      const list = await g.glossaryList(query);
      setTerms(list);
      try {
        const raw = await g.glossaryHotwordsPreview();
        setHotwordsPreview(parseGlossaryHotwordsPreview(raw));
      } catch {
        // Keep existing preview on error to avoid misleading "no hotwords" UI
      } finally {
        setHotwordsPreviewLoaded(true);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const lastBackendSearchRef = useRef("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q === lastBackendSearchRef.current) return;
    lastBackendSearchRef.current = q;
    const timer = setTimeout(() => {
      void refresh(q || undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, refresh]);

  return {
    terms,
    searchQuery,
    setSearchQuery,
    hotwordFilter,
    setHotwordFilter,
    sortMode,
    setSortMode,
    filteredTerms,
    visibleTerms,
    visibleIds,
    visibleIdSet,
    hotwordsPreview,
    hotwordsPreviewLoaded,
    hotwordEnabledCount,
    loadError,
    refresh,
  };
}
