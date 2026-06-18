import { FileAudio, FileText, History } from "lucide-react";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import {
  formatWelcomeFileMatchLabel,
  type WelcomeSearchScope,
} from "../services/welcome/welcomeSearch";
import {
  sliceWelcomeSearchResults,
  type WelcomeSearchNavItem,
} from "../services/welcome/welcomeSearchNav";
import type { WelcomeContentSearchHit, WelcomeFileSearchHit } from "../tauri/welcomeSearchApi";
import { formatMediaTime } from "../utils/formatMediaTime";
import { formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WelcomeSearchScopeChips } from "./WelcomeSearchScopeChips";
import {
  WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS,
  WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS,
} from "../config/workspaceShellLayout";

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

function findFileNavIndex(navItems: WelcomeSearchNavItem[], hit: WelcomeFileSearchHit): number {
  return navItems.findIndex(
    (n) => n.type === "file" && n.hit.file_id === hit.file_id && n.hit.matched_field === hit.matched_field,
  );
}

function findContentNavIndex(navItems: WelcomeSearchNavItem[], hit: WelcomeContentSearchHit): number {
  return navItems.findIndex(
    (n) =>
      n.type === "content" &&
      n.hit.file_id === hit.file_id &&
      n.hit.segment_idx === hit.segment_idx &&
      n.hit.char_start === hit.char_start,
  );
}

function rowActiveClass(active: boolean): string {
  return active ? "bg-notion-sidebar-active" : "hover:bg-notion-sidebar-hover";
}

const RESULT_LIST_CLASS = "m-0 max-h-80 list-none overflow-y-auto p-0";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-1 text-label font-medium text-notion-text-light">
      {children}
    </p>
  );
}

function EmptySectionNote({ children }: { children: React.ReactNode }) {
  return <li className="px-2.5 py-0.5 text-label text-notion-text-muted">{children}</li>;
}

function FileHitRow({
  hit,
  active,
  onSelect,
  onOpen,
}: {
  hit: WelcomeFileSearchHit;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <li>
      <div className={`flex items-stretch gap-0.5 px-1.5 py-1 ${rowActiveClass(active)}`}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1.5 border-0 bg-transparent px-1 py-0 text-left"
          onClick={onSelect}
        >
          <span className="shrink-0 text-notion-text-light">
            <FileText className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm text-notion-text">{hit.file_name}</span>
            <span className="mt-px block truncate text-label text-notion-text-muted">
              {hit.project_name} · {formatWelcomeFileMatchLabel(hit.matched_field)} ·{" "}
              {formatWorkspaceFileTime(hit.updated_at_ms)}
            </span>
          </span>
        </button>
        <button
          type="button"
          className="shrink-0 self-center rounded px-1.5 py-0.5 text-label text-accent-action hover:bg-notion-sidebar-active"
          onClick={onOpen}
        >
          打开
        </button>
      </div>
    </li>
  );
}

function ContentHitRow({
  hit,
  active,
  onSelect,
}: {
  hit: WelcomeContentSearchHit;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-start gap-1.5 border-0 bg-transparent px-2.5 py-1 text-left ${rowActiveClass(active)}`}
        onClick={onSelect}
      >
        <span className="shrink-0 text-notion-text-light">
          <FileAudio className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <FindReplaceMatchText
            variant="inline"
            text={hit.snippet}
            charStart={hit.char_start}
            charEnd={hit.char_end}
            className="text-notion-text"
          />
          <span className="mt-px block truncate text-label text-notion-text-muted">
            {hit.project_name} / {hit.file_name} · {formatMediaTime(hit.start_sec)}
          </span>
        </span>
      </button>
    </li>
  );
}

function EmptyQueryState({
  recentQueries,
  navItems,
  activeIndex,
  onRecentQuerySelect,
}: {
  recentQueries: string[];
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  onRecentQuerySelect: (query: string) => void;
}) {
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
          <li key={`q:${q}`}>
            <button
              type="button"
              className={`flex w-full items-center gap-1.5 border-0 bg-transparent px-2.5 py-1 text-left text-sm ${rowActiveClass(activeIndex === idx)}`}
              onClick={() => onRecentQuerySelect(q)}
            >
              <History className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              <span className="truncate text-notion-text">{q}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QueryResultsState({
  scope,
  queryEmpty,
  fileResults,
  contentResults,
  navItems,
  activeIndex,
  onFileSelect,
  onFileOpen,
  onContentSelect,
}: {
  scope: WelcomeSearchScope;
  queryEmpty: boolean;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  onFileSelect: (hit: WelcomeFileSearchHit) => void;
  onFileOpen: (hit: WelcomeFileSearchHit) => void;
  onContentSelect: (hit: WelcomeContentSearchHit) => void;
}) {
  const { files, content } = sliceWelcomeSearchResults(scope, fileResults, contentResults);
  const showFiles = scope !== "content";
  const showContent = scope !== "file";
  const hasFiles = files.length > 0;
  const hasContent = content.length > 0;

  if (!queryEmpty && !hasFiles && !hasContent) {
    return (
      <div className="space-y-0.5 px-2.5 py-2 text-sm text-notion-text-muted">
        {showFiles ? <p>无匹配项目或文件</p> : null}
        {showContent ? <p>无匹配语段</p> : null}
      </div>
    );
  }

  return (
    <ul className={RESULT_LIST_CLASS} role="listbox">
      {showFiles && hasFiles ? <SectionLabel>文件</SectionLabel> : null}
      {showFiles
        ? files.map((hit) => {
            const idx = findFileNavIndex(navItems, hit);
            return (
              <FileHitRow
                key={`${hit.file_id}:${hit.matched_field}`}
                hit={hit}
                active={activeIndex === idx}
                onSelect={() => onFileSelect(hit)}
                onOpen={() => onFileOpen(hit)}
              />
            );
          })
        : null}
      {showFiles && !hasFiles && !queryEmpty ? (
        <EmptySectionNote>无文件名或元信息匹配</EmptySectionNote>
      ) : null}
      {showContent && hasContent ? <SectionLabel>转写正文</SectionLabel> : null}
      {showContent
        ? content.map((hit) => {
            const idx = findContentNavIndex(navItems, hit);
            return (
              <ContentHitRow
                key={`${hit.file_id}:${hit.segment_idx}:${hit.char_start}`}
                hit={hit}
                active={activeIndex === idx}
                onSelect={() => onContentSelect(hit)}
              />
            );
          })
        : null}
      {showContent && !hasContent && !queryEmpty ? (
        <EmptySectionNote>无正文匹配</EmptySectionNote>
      ) : null}
    </ul>
  );
}

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
      role="dialog"
      aria-label="工作区搜索"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS}>
        <WelcomeSearchScopeChips scope={scope} disabled={scopeDisabled} onChange={onScopeChange} />
      </div>

      {loading ? (
        <p className="px-2.5 py-2 text-sm text-notion-text-muted">搜索中…</p>
      ) : error ? (
        <p className="px-2.5 py-2 text-sm text-zen-cinnabar">{error}</p>
      ) : queryEmpty ? (
        <EmptyQueryState
          recentQueries={recentQueries}
          navItems={navItems}
          activeIndex={activeIndex}
          onRecentQuerySelect={onRecentQuerySelect}
        />
      ) : (
        <QueryResultsState
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
