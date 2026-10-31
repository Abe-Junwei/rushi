import { useMemo, type ReactNode } from "react";
import {
  WELCOME_LEDGER_DIVIDER_PT,
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_TAB_GAP,
  WELCOME_LEDGER_TAB_MB,
} from "../config/workspaceShellLayout";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import {
  sortRecentFilesByMode,
  type WelcomeLedgerSortMode,
} from "../utils/welcomeLedgerSort";
import { WelcomeFileLedgerRow } from "./WelcomeFileLedgerRow";
import { WelcomeLedgerScrollFrame } from "./WelcomeLedgerScrollFrame";
import { WelcomeLedgerSortMenu } from "./WelcomeLedgerSortMenu";
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
  sortMode: WelcomeLedgerSortMode;
  onSortModeChange: (mode: WelcomeLedgerSortMode) => void;
};

const TAB_BASE =
  "border-0 bg-transparent px-0 py-1 text-title font-medium transition-colors disabled:cursor-not-allowed";

/**
 * 欢迎页文件 ledger：最近 / 所有（项目库）；搜索靠右；排序入口在搜索左侧。
 * 单页滚动 + 上下渐变（「所有」由项目库自带同一壳）。
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
  sortMode,
  onSortModeChange,
}: Props) {
  const sortedFiles = useMemo(
    () => sortRecentFilesByMode(files, sortMode),
    [files, sortMode],
  );

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
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <WelcomeLedgerSortMenu
            value={sortMode}
            onChange={onSortModeChange}
            disabled={busy}
          />
          <WelcomeSearchField
            search={search}
            disabled={busy}
            inputClassName={`${WELCOME_SEARCH_INPUT_CLASS} w-40 pl-8 pr-2`}
          />
        </div>
      </div>

      <div className="welcome-ledger-viewport" data-purpose="welcome-ledger-viewport">
        {activeTab === "all" ? (
          allFilesContent
        ) : (
          <WelcomeLedgerScrollFrame
            contentKey={`${loading ? "loading" : "ready"}:${sortedFiles.length}:${sortMode}`}
            purpose="welcome-recent-ledger-scroll"
          >
            <ul className="m-0 list-none p-0">
              {loading ? (
                <li className={WELCOME_LEDGER_INSET_X}>
                  <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
                    正在加载最近文件…
                  </p>
                </li>
              ) : sortedFiles.length > 0 ? (
                sortedFiles.map((f) => (
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
          </WelcomeLedgerScrollFrame>
        )}
      </div>
    </section>
  );
}
