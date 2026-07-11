import { History } from "lucide-react";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { WelcomeSearchNavItem } from "../services/welcome/welcomeSearchNav";

function rowActiveClass(active: boolean): string {
  return active ? "bg-notion-sidebar-active" : "hover:bg-notion-sidebar-hover";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-1 text-label font-medium text-notion-text-light">{children}</p>
  );
}

type Props = {
  recentQueries: string[];
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  onRecentQuerySelect: (query: string) => void;
};

const RESULT_LIST_CLASS = "m-0 max-h-80 list-none overflow-y-auto p-0";

export function WelcomeSearchEmptyQueryState({
  recentQueries,
  navItems,
  activeIndex,
  onRecentQuerySelect,
}: Props) {
  if (recentQueries.length === 0) {
    return (
      <p className="px-2.5 py-2 text-sm text-notion-text-muted">
        输入关键词，同时搜索文件名与转写正文
      </p>
    );
  }

  return (
    <ul className={RESULT_LIST_CLASS} role="listbox">
      <SectionLabel>最近搜索</SectionLabel>
      {recentQueries.map((q) => {
        const idx = navItems.findIndex((n) => n.type === "recent-query" && n.query === q);
        return (
          <li
            key={`q:${q}`}
            id={idx >= 0 ? `welcome-search-item-${idx}` : undefined}
            role="option"
            aria-selected={activeIndex === idx}
          >
            <button
              type="button"
              className={`flex w-full items-center gap-1.5 border-0 bg-transparent px-2.5 py-1 text-left text-sm ${rowActiveClass(activeIndex === idx)}`}
              onClick={() => onRecentQuerySelect(q)}
            >
              <History
                className={LUCIDE_ICON_SIZE_SM}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
              <span className="truncate text-notion-text">{q}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
