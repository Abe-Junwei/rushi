import { IconSearch as Search } from "@tabler/icons-react";
import type { useWelcomeSearchController } from "../hooks/useWelcomeSearchController";
import { requestCloseActivityInbox } from "../services/ui/activityInboxEvents";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WelcomeSearchResults } from "./WelcomeSearchResults";

export type WelcomeSearchController = ReturnType<typeof useWelcomeSearchController>;

/** 无边框搜索输入基底（不含宽度；ledger / 顶栏各自加宽） */
export const WELCOME_SEARCH_INPUT_CLASS =
  "box-border block h-8 min-h-8 rounded-sm border-0 bg-transparent py-1.5 pl-9 pr-3 font-sans text-sm font-normal leading-snug text-notion-text shadow-none ring-0 outline-none transition-colors placeholder:text-notion-text-light hover:bg-notion-sidebar/55 focus:bg-notion-sidebar/55 focus:shadow-none focus:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-action/25 disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  search: WelcomeSearchController;
  disabled?: boolean;
  /** 覆盖默认宽度等；默认已无边框 */
  inputClassName?: string;
};

/** 欢迎页全文检索输入 + 下拉结果（顶栏 / ledger 共用）。 */
export function WelcomeSearchField({
  search,
  disabled = false,
  inputClassName = `${WELCOME_SEARCH_INPUT_CLASS} w-64`,
}: Props) {
  return (
    <div ref={search.searchRootRef} className="relative shrink-0">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-notion-text-light">
        <Search className={`block ${LUCIDE_ICON_SIZE_MD}`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </span>
      <input
        type="search"
        className={inputClassName}
        placeholder="搜索文件与转写内容…"
        disabled={disabled}
        value={search.query}
        aria-label="搜索文件与转写内容"
        aria-expanded={search.showPanel}
        aria-controls="welcome-search-panel"
        aria-activedescendant={
          search.activeIndex >= 0 ? `welcome-search-item-${search.activeIndex}` : undefined
        }
        onFocus={() => {
          requestCloseActivityInbox();
          search.setOpen(true);
        }}
        onChange={(e) => {
          search.setQuery(e.target.value);
          search.setOpen(true);
        }}
        onKeyDown={search.handleInputKeyDown}
      />
      {search.showPanel ? (
        <div id="welcome-search-panel">
          <WelcomeSearchResults
            scope={search.scope}
            queryEmpty={search.queryEmpty}
            scopeDisabled={disabled}
            loading={search.loading}
            error={search.error}
            fileResults={search.fileResults}
            contentResults={search.contentResults}
            recentQueries={search.recentQueries}
            navItems={search.navItems}
            activeIndex={search.activeIndex}
            onScopeChange={search.setScope}
            onFileSelect={(hit) => void search.navigateToFileHub(hit)}
            onFileOpen={(hit) => void search.openFileFromSearch(hit)}
            onContentSelect={(hit) => void search.navigateToContentHit(hit)}
            onRecentQuerySelect={(q) => {
              search.setQuery(q);
              search.setOpen(true);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
