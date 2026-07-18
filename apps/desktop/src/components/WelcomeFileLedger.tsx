import {
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_TAB_GAP,
} from "../config/workspaceShellLayout";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import { WelcomeFileLedgerRow } from "./WelcomeFileLedgerRow";

type Props = {
  files: RecentWorkspaceFile[];
  loading: boolean;
  busy?: boolean;
  onOpenFile: (file: RecentWorkspaceFile) => void;
};

const TAB_BASE =
  "-mb-px border-0 border-b-2 bg-transparent px-0 pb-3 text-title font-medium transition-colors disabled:cursor-not-allowed";

/**
 * 欢迎页最近文件 ledger：顶栏 tab（仅「最近」可用）+ 左文右进度行。
 * Hero / CTA 不在此组件内。间距对齐设计稿：tab gap-8、栏/行同 px-6、栏下 mb-6。
 */
export function WelcomeFileLedger({ files, loading, busy, onOpenFile }: Props) {
  return (
    <section className="flex flex-col" aria-label="最近文件">
      <div
        className={`mb-6 flex items-end justify-between gap-4 border-b border-notion-border ${WELCOME_LEDGER_INSET_X}`}
      >
        <div
          className={`flex min-w-0 items-end ${WELCOME_LEDGER_TAB_GAP}`}
          role="tablist"
          aria-label="文件筛选"
        >
          <button
            type="button"
            role="tab"
            aria-selected
            className={`${TAB_BASE} bg-transparent border-notion-text text-notion-text`}
          >
            最近文件
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled
            className={`${TAB_BASE} bg-transparent border-transparent text-notion-text-light opacity-40`}
            title="即将推出"
          >
            所有文件
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled
            className={`${TAB_BASE} bg-transparent border-transparent text-notion-text-light opacity-40`}
            title="即将推出"
          >
            星标
          </button>
        </div>
        <span
          className={`${PANEL_TYPOGRAPHY.meta} shrink-0 pb-3 tabular-nums text-notion-text-muted`}
        >
          {loading ? "…" : `${files.length} 个文件`}
        </span>
      </div>

      <ul className="m-0 list-none p-0">
        {loading ? (
          <li className={WELCOME_LEDGER_INSET_X}>
            <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
              正在加载最近文件…
            </p>
          </li>
        ) : files.length > 0 ? (
          files.map((f) => (
            <li key={f.fileId} className="border-b border-notion-border">
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
    </section>
  );
}
