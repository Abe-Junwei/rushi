import { useCallback, useEffect, useRef, useState } from "react";
import {
  welcomeSearchContent,
  welcomeSearchFiles,
  type WelcomeContentSearchHit,
  type WelcomeFileSearchHit,
} from "../tauri/welcomeSearchApi";

const SEARCH_DEBOUNCE_MS = 320;

export type WelcomeSearchQueryApi = {
  query: string;
  setQuery: (q: string) => void;
  debouncedQuery: string;
  queryEmpty: boolean;
  loading: boolean;
  error: string | null;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
  resetQuery: () => void;
};

export function useWelcomeSearchQuery(): WelcomeSearchQueryApi {
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileResults, setFileResults] = useState<WelcomeFileSearchHit[]>([]);
  const [contentResults, setContentResults] = useState<WelcomeContentSearchHit[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const resetQuery = useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
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

  return {
    query,
    setQuery,
    debouncedQuery,
    queryEmpty: debouncedQuery.length === 0,
    loading,
    error,
    fileResults,
    contentResults,
    resetQuery,
  };
}
