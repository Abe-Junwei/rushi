import {
  IconFileMusic as FileAudio,
} from "@tabler/icons-react";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { formatMediaTime } from "../utils/formatMediaTime";
import type { WelcomeContentSearchHit } from "../tauri/welcomeSearchApi";

function rowActiveClass(active: boolean): string {
  return active ? "bg-notion-sidebar-active" : "hover:bg-notion-sidebar-hover";
}

type Props = {
  id?: string;
  hit: WelcomeContentSearchHit;
  active: boolean;
  onSelect: () => void;
};

export function WelcomeSearchContentHitRow({ id, hit, active, onSelect }: Props) {
  return (
    <li id={id} role="option" aria-selected={active}>
      <button
        type="button"
        className={`flex w-full items-start gap-1.5 border-0 bg-transparent px-2.5 py-1 text-left ${rowActiveClass(active)}`}
        onClick={onSelect}
      >
        <span className="shrink-0 text-notion-text-light">
          <FileAudio
            className={LUCIDE_ICON_SIZE_SM}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
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
