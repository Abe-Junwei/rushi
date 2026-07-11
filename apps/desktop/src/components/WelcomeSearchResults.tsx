import {
  WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS,
  WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS,
} from "../config/workspaceShellLayout";
import { WelcomeSearchScopeChips } from "./WelcomeSearchScopeChips";
import { WelcomeSearchEmptyQueryState } from "./WelcomeSearchEmptyQueryState";
import { WelcomeSearchQueryResultsState } from "./WelcomeSearchQueryResultsState";
import type { WelcomeContentSearchHit, WelcomeFileSearchHit } from "../tauri/welcomeSearchApi";
import type { WelcomeSearchScope } from "../services/welcome/welcomeSearch";
import type { WelcomeSearchNavItem } from "../services/welcome/welcomeSearchNav";

type Props = {
  scope: WelcomeSearchScope;
  queryEmpty: boolean;
  scopeDisabled?: boolean;
  loading: boolean;
  error: string | null;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
  recentQueries: string[];
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  onScopeChange: (scope: WelcomeSearchScope) => void;
  onFileSelect: (hit: WelcomeFileSearchHit) => void;
  onFileOpen: (hit: WelcomeFileSearchHit) => void;
  onContentSelect: (hit: WelcomeContentSearchHit) => void;
  onRecentQuerySelect: (query: string) => void;
};

export function WelcomeSearchResults({
  scope,
  queryEmpty,
  scopeDisabled,
  loading,
  error,
  fileResults,
  contentResults,
  recentQueries,
  navItems,
  activeIndex,
  onScopeChange,
  onFileSelect,
  onFileOpen,
  onContentSelect,
  onRecentQuerySelect,
}: Props) {
  return (
    <div
      className={`${WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS} z-50`}
      role="region"
      aria-label="搜索结果"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS}>
        <WelcomeSearchScopeChips scope={scope} disabled={scopeDisabled} onChange={onScopeChange} />
      </div>

      {loading ? (
        <p className="px-2.5 py-2 text-sm text-notion-text-muted">搜索中...</p>
      ) : error ? (
        <p className="px-2.5 py-2 text-sm text-zen-cinnabar">{error}</p>
      ) : queryEmpty ? (
        <WelcomeSearchEmptyQueryState
          recentQueries={recentQueries}
          navItems={navItems}
          activeIndex={activeIndex}
          onRecentQuerySelect={onRecentQuerySelect}
        />
      ) : (
        <WelcomeSearchQueryResultsState
          scope={scope}
          queryEmpty={queryEmpty}
          fileResults={fileResults}
          contentResults={contentResults}
          navItems={navItems}
          activeIndex={activeIndex}
          onFileSelect={onFileSelect}
          onFileOpen={onFileOpen}
          onContentSelect={onContentSelect}
        />
      )}
    </div>
  );
}
