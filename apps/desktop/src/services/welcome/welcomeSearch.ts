export const WELCOME_SEARCH_SCOPE_STORAGE_KEY = "rushi:welcome-search-scope:v1";
/** @deprecated v1 scope key — migrated on read */
export const WELCOME_SEARCH_MODE_STORAGE_KEY = "rushi:welcome-search-mode:v1";
export const WELCOME_SEARCH_RECENT_STORAGE_KEY = "rushi:welcome-search-recent:v1";

export type WelcomeSearchScope = "all" | "file" | "content";

const RECENT_QUERY_LIMIT = 5;

export function readWelcomeSearchScope(): WelcomeSearchScope {
  try {
    const raw =
      window.localStorage.getItem(WELCOME_SEARCH_SCOPE_STORAGE_KEY) ??
      window.localStorage.getItem(WELCOME_SEARCH_MODE_STORAGE_KEY);
    if (raw === "file" || raw === "content" || raw === "all") return raw;
  } catch {
    /* ignore */
  }
  return "all";
}

export function writeWelcomeSearchScope(scope: WelcomeSearchScope): void {
  try {
    window.localStorage.setItem(WELCOME_SEARCH_SCOPE_STORAGE_KEY, scope);
  } catch {
    /* quota / private mode */
  }
}

export function readRecentSearchQueries(): string[] {
  try {
    const raw = window.localStorage.getItem(WELCOME_SEARCH_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
  } catch {
    return [];
  }
}

export function pushRecentSearchQuery(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const prev = readRecentSearchQueries().filter((q) => q !== trimmed);
  const next = [trimmed, ...prev].slice(0, RECENT_QUERY_LIMIT);
  try {
    window.localStorage.setItem(WELCOME_SEARCH_RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const MATCHED_FIELD_LABELS: Record<string, string> = {
  file_name: "文件名匹配",
  project_name: "项目名匹配",
  narrator: "讲述人匹配",
  recorded_at: "时间匹配",
  location: "地点匹配",
  subject: "主题匹配",
  transcriber: "转录人匹配",
};

export function formatWelcomeFileMatchLabel(matchedField: string): string {
  return MATCHED_FIELD_LABELS[matchedField] ?? "匹配";
}

let pendingHubFileId: string | null = null;

export function setWelcomeSearchHubFileTarget(fileId: string): void {
  pendingHubFileId = fileId;
}

export function consumeWelcomeSearchHubFileTarget(): string | null {
  const id = pendingHubFileId;
  pendingHubFileId = null;
  return id;
}
