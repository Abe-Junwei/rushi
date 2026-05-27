import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [hotwordsPreview, setHotwordsPreview] = useState<GlossaryHotwordsPreview | null>(null);
  const [loadError, setLoadError] = useState("");

  const filteredTerms = useMemo(
    () => applyGlossaryFilters(terms, searchQuery, hotwordFilter),
    [terms, searchQuery, hotwordFilter],
  );

  const visibleTerms = useMemo(
    () => filteredTerms.slice(0, GLOSSARY_LIST_DISPLAY_CAP),
    [filteredTerms],
  );

  const visibleIds = useMemo(() => visibleTerms.map((row) => row.id), [visibleTerms]);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const hotwordEnabledCount = useMemo(() => countHotwordEnabledTerms(terms), [terms]);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const list = await g.glossaryList();
      setTerms(list);
      try {
        const raw = await g.glossaryHotwordsPreview();
        setHotwordsPreview(parseGlossaryHotwordsPreview(raw));
      } catch {
        // Keep existing preview on error to avoid misleading "no hotwords" UI
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    terms,
    searchQuery,
    setSearchQuery,
    hotwordFilter,
    setHotwordFilter,
    filteredTerms,
    visibleTerms,
    visibleIds,
    visibleIdSet,
    hotwordsPreview,
    hotwordEnabledCount,
    loadError,
    refresh,
  };
}
