import type { WelcomeContentSearchHit, WelcomeFileSearchHit } from "../../tauri/welcomeSearchApi";
import type { WelcomeSearchScope } from "./welcomeSearch";

export const WELCOME_SEARCH_FILE_PREVIEW_LIMIT = 5;
export const WELCOME_SEARCH_CONTENT_PREVIEW_LIMIT = 10;

export type WelcomeSearchNavItem =
  | { type: "recent-query"; query: string }
  | { type: "file"; hit: WelcomeFileSearchHit }
  | { type: "content"; hit: WelcomeContentSearchHit };

export function sliceWelcomeSearchResults(
  scope: WelcomeSearchScope,
  fileResults: WelcomeFileSearchHit[],
  contentResults: WelcomeContentSearchHit[],
): { files: WelcomeFileSearchHit[]; content: WelcomeContentSearchHit[] } {
  if (scope === "file") {
    return { files: fileResults, content: [] };
  }
  if (scope === "content") {
    return { files: [], content: contentResults };
  }
  return {
    files: fileResults.slice(0, WELCOME_SEARCH_FILE_PREVIEW_LIMIT),
    content: contentResults.slice(0, WELCOME_SEARCH_CONTENT_PREVIEW_LIMIT),
  };
}

export function buildWelcomeSearchNavItems(args: {
  queryEmpty: boolean;
  recentQueries: string[];
  scope: WelcomeSearchScope;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
}): WelcomeSearchNavItem[] {
  if (args.queryEmpty) {
    return args.recentQueries.map((query) => ({ type: "recent-query", query }));
  }

  const { files, content } = sliceWelcomeSearchResults(
    args.scope,
    args.fileResults,
    args.contentResults,
  );
  const items: WelcomeSearchNavItem[] = [];
  for (const hit of files) {
    items.push({ type: "file", hit });
  }
  for (const hit of content) {
    items.push({ type: "content", hit });
  }
  return items;
}

export const WELCOME_SEARCH_SCOPE_ORDER: WelcomeSearchScope[] = ["all", "file", "content"];

export function cycleWelcomeSearchScope(
  current: WelcomeSearchScope,
  direction: 1 | -1,
): WelcomeSearchScope {
  const idx = WELCOME_SEARCH_SCOPE_ORDER.indexOf(current);
  const next = (idx + direction + WELCOME_SEARCH_SCOPE_ORDER.length) % WELCOME_SEARCH_SCOPE_ORDER.length;
  return WELCOME_SEARCH_SCOPE_ORDER[next] ?? "all";
}
