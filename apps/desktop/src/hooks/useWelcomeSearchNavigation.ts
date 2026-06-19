import { useCallback, useMemo, useState } from "react";
import {
  buildWelcomeSearchNavItems,
  type WelcomeSearchNavItem,
} from "../services/welcome/welcomeSearchNav";
import type { WelcomeContentSearchHit, WelcomeFileSearchHit } from "../tauri/welcomeSearchApi";
import type { WelcomeSearchScope } from "../services/welcome/welcomeSearch";

export type WelcomeSearchNavigationApi = {
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  setActiveIndex: (idx: number) => void;
  moveActiveIndex: (delta: number) => void;
  resetActiveIndex: () => void;
};

type UseWelcomeSearchNavigationInput = {
  queryEmpty: boolean;
  recentQueries: string[];
  scope: WelcomeSearchScope;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
};

export function useWelcomeSearchNavigation({
  queryEmpty,
  recentQueries,
  scope,
  fileResults,
  contentResults,
}: UseWelcomeSearchNavigationInput): WelcomeSearchNavigationApi {
  const [activeIndex, setActiveIndex] = useState(-1);

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

  const resetActiveIndex = useCallback(() => {
    setActiveIndex(-1);
  }, []);

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

  return {
    navItems,
    activeIndex,
    setActiveIndex,
    moveActiveIndex,
    resetActiveIndex,
  };
}
