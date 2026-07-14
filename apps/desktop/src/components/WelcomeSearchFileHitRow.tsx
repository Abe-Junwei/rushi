import {
  IconFileText as FileText,
} from "@tabler/icons-react";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { formatWelcomeFileMatchLabel } from "../services/welcome/welcomeSearch";
import { formatWorkspaceFileTime } from "../utils/projectFileDisplay";
import type { WelcomeFileSearchHit } from "../tauri/welcomeSearchApi";

function rowActiveClass(active: boolean): string {
  return active ? "bg-notion-sidebar-active" : "hover:bg-notion-sidebar-hover";
}

type Props = {
  id?: string;
  hit: WelcomeFileSearchHit;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

export function WelcomeSearchFileHitRow({ id, hit, active, onSelect, onOpen }: Props) {
  return (
    <li id={id} role="option" aria-selected={active}>
      <div className={`flex items-stretch gap-0.5 px-1.5 py-1 ${rowActiveClass(active)}`}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1.5 border-0 bg-transparent px-1 py-0 text-left"
          onClick={onSelect}
        >
          <span className="shrink-0 text-notion-text-light">
            <FileText
              className={LUCIDE_ICON_SIZE_SM}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
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
