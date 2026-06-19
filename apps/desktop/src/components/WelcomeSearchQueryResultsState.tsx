import { WelcomeSearchContentHitRow } from "./WelcomeSearchContentHitRow";
import { WelcomeSearchFileHitRow } from "./WelcomeSearchFileHitRow";
import { sliceWelcomeSearchResults } from "../services/welcome/welcomeSearchNav";
import type { WelcomeSearchNavItem } from "../services/welcome/welcomeSearchNav";
import type { WelcomeContentSearchHit, WelcomeFileSearchHit } from "../tauri/welcomeSearchApi";
import type { WelcomeSearchScope } from "../services/welcome/welcomeSearch";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-1 text-label font-medium text-notion-text-light">{children}</p>
  );
}

function EmptySectionNote({ children }: { children: React.ReactNode }) {
  return <li className="px-2.5 py-0.5 text-label text-notion-text-muted">{children}</li>;
}

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

type Props = {
  scope: WelcomeSearchScope;
  queryEmpty: boolean;
  fileResults: WelcomeFileSearchHit[];
  contentResults: WelcomeContentSearchHit[];
  navItems: WelcomeSearchNavItem[];
  activeIndex: number;
  onFileSelect: (hit: WelcomeFileSearchHit) => void;
  onFileOpen: (hit: WelcomeFileSearchHit) => void;
  onContentSelect: (hit: WelcomeContentSearchHit) => void;
};

const RESULT_LIST_CLASS = "m-0 max-h-80 list-none overflow-y-auto p-0";

export function WelcomeSearchQueryResultsState({
  scope,
  queryEmpty,
  fileResults,
  contentResults,
  navItems,
  activeIndex,
  onFileSelect,
  onFileOpen,
  onContentSelect,
}: Props) {
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
              <WelcomeSearchFileHitRow
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
              <WelcomeSearchContentHitRow
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
