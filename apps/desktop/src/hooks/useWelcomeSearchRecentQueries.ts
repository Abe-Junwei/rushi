import { useCallback, useEffect, useState } from "react";
import {
  pushRecentSearchQuery,
  readRecentSearchQueries,
} from "../services/welcome/welcomeSearch";

export type WelcomeSearchRecentQueriesApi = {
  recentQueries: string[];
  rememberQuery: (q: string) => void;
  refreshRecentQueries: () => void;
};

export function useWelcomeSearchRecentQueries(open: boolean): WelcomeSearchRecentQueriesApi {
  const [recentQueries, setRecentQueries] = useState<string[]>(() => readRecentSearchQueries());

  const rememberQuery = useCallback((q: string) => {
    pushRecentSearchQuery(q);
    setRecentQueries(readRecentSearchQueries());
  }, []);

  const refreshRecentQueries = useCallback(() => {
    setRecentQueries(readRecentSearchQueries());
  }, []);

  useEffect(() => {
    if (open) refreshRecentQueries();
  }, [open, refreshRecentQueries]);

  return {
    recentQueries,
    rememberQuery,
    refreshRecentQueries,
  };
}
