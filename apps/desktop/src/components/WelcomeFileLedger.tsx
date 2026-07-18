import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
} from "@tabler/icons-react";
import { CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  WELCOME_LEDGER_DIVIDER_PT,
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_TAB_GAP,
  WELCOME_LEDGER_TAB_MB,
} from "../config/workspaceShellLayout";
import { useViewportHeight } from "../hooks/useViewportHeight";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import {
  clampProjectLibraryPage,
  projectLibraryPageCount,
  sliceProjectLibraryPage,
  welcomeRecentPageSizeForHeight,
} from "../utils/projectLibraryPagination";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WelcomeFileLedgerRow } from "./WelcomeFileLedgerRow";
import {
  WELCOME_SEARCH_INPUT_CLASS,
  WelcomeSearchField,
  type WelcomeSearchController,
} from "./WelcomeSearchField";

export type WelcomeLedgerTabId = "recent" | "all";

type Props = {
  activeTab: WelcomeLedgerTabId;
  onTabChange: (tab: WelcomeLedgerTabId) => void;
  files: RecentWorkspaceFile[];
  loading: boolean;
  busy?: boolean;
  onOpenFile: (file: RecentWorkspaceFile) => void;
  /** 「所有」内容（项目库） */
  allFilesContent: ReactNode;
  /** 靠右、略窄 */
  search: WelcomeSearchController;
};

const TAB_BASE =
  "border-0 bg-transparent px-0 py-1 text-title font-medium transition-colors disabled:cursor-not-allowed";

/**
 * 欢迎页文件 ledger：最近 / 所有（项目库）；搜索靠右。
 * 列表视口禁滚动；超可视高度分页。
 */
export function WelcomeFileLedger({
  activeTab,
  onTabChange,
  files,
  loading,
  busy,
  onOpenFile,
  allFilesContent,
  search,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportH = useViewportHeight(viewportRef);
  const [recentPage, setRecentPage] = useState(0);

  const recentPageSize = welcomeRecentPageSizeForHeight(viewportH);
  const recentPageCount = projectLibraryPageCount(files.length, recentPageSize);
  const safeRecentPage = clampProjectLibraryPage(recentPage, files.length, recentPageSize);
  const pageFiles = useMemo(
    () => sliceProjectLibraryPage(files, safeRecentPage, recentPageSize),
    [files, safeRecentPage, recentPageSize],
  );
  const showRecentPager = files.length > recentPageSize;

  useEffect(() => {
    setRecentPage((prev) => clampProjectLibraryPage(prev, files.length, recentPageSize));
  }, [files.length, recentPageSize]);

  useEffect(() => {
    if (activeTab === "recent") setRecentPage(0);
  }, [activeTab]);

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col border-t border-notion-divider ${WELCOME_LEDGER_DIVIDER_PT}`}
      aria-label="文件筛选区"
    >
      <div
        className={`${WELCOME_LEDGER_TAB_MB} flex shrink-0 items-center gap-4 ${WELCOME_LEDGER_INSET_X}`}
      >
        <div
          className={`flex min-w-0 items-center ${WELCOME_LEDGER_TAB_GAP}`}
          role="tablist"
          aria-label="文件筛选"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recent"}
            className={
              activeTab === "recent"
                ? `${TAB_BASE} font-semibold text-notion-text`
                : `${TAB_BASE} text-notion-text-light hover:text-notion-text`
            }
            onClick={() => onTabChange("recent")}
          >
            最近
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={
              activeTab === "all"
                ? `${TAB_BASE} font-semibold text-notion-text`
                : `${TAB_BASE} text-notion-text-light hover:text-notion-text`
            }
            onClick={() => onTabChange("all")}
          >
            所有
          </button>
        </div>
        <div className="ml-auto shrink-0">
          <WelcomeSearchField
            search={search}
            disabled={busy}
            inputClassName={`${WELCOME_SEARCH_INPUT_CLASS} w-40 pl-8 pr-2`}
          />
        </div>
      </div>

      <div ref={viewportRef} className="welcome-ledger-viewport" data-purpose="welcome-ledger-viewport">
        {activeTab === "all" ? (
          allFilesContent
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ul className="m-0 min-h-0 flex-1 list-none overflow-hidden p-0">
              {loading ? (
                <li className={WELCOME_LEDGER_INSET_X}>
                  <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
                    正在加载最近文件…
                  </p>
                </li>
              ) : pageFiles.length > 0 ? (
                pageFiles.map((f) => (
                  <li key={f.fileId}>
                    <WelcomeFileLedgerRow file={f} busy={busy} onOpen={() => onOpenFile(f)} />
                  </li>
                ))
              ) : (
                <li className={WELCOME_LEDGER_INSET_X}>
                  <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
                    暂无最近文件，请先新建项目或导入内容包。
                  </p>
                </li>
              )}
            </ul>
            {showRecentPager ? (
              <nav
                className={`mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-notion-border/70 py-2 ${WELCOME_LEDGER_INSET_X}`}
                aria-label="最近文件翻页"
              >
                <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
                  {`第 ${safeRecentPage + 1} / ${recentPageCount} 页`}
                </span>
                <button
                  type="button"
                  className={CONTROL_BTN_ICON_GHOST}
                  disabled={busy || safeRecentPage <= 0}
                  aria-label="上一页"
                  title="上一页"
                  onClick={() =>
                    setRecentPage((p) => clampProjectLibraryPage(p - 1, files.length, recentPageSize))
                  }
                >
                  <ChevronLeft
                    className={LUCIDE_ICON_SIZE_MD}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  className={CONTROL_BTN_ICON_GHOST}
                  disabled={busy || safeRecentPage >= recentPageCount - 1}
                  aria-label="下一页"
                  title="下一页"
                  onClick={() =>
                    setRecentPage((p) => clampProjectLibraryPage(p + 1, files.length, recentPageSize))
                  }
                >
                  <ChevronRight
                    className={LUCIDE_ICON_SIZE_MD}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    aria-hidden
                  />
                </button>
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
