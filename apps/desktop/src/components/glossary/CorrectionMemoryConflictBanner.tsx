import { AlertTriangle } from "lucide-react";
import type { CorrectionMemoryConflictGroup } from "../../services/correctionMemoryConflicts";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

type Props = {
  groups: CorrectionMemoryConflictGroup[];
};

export function CorrectionMemoryConflictBanner({ groups }: Props) {
  if (!groups.length) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-md bg-accent-action/10 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`mt-0.5 shrink-0 ${LUCIDE_ICON_SIZE_SM} text-accent-action`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={`m-0 ${PANEL_TYPOGRAPHY.sectionTitle}`}>同错形、多种正词</p>
          <p className={`m-0 mt-1 ${PANEL_TYPOGRAPHY.meta}`}>
            以下错形对应多个正词；应用规则时同长度下后写入者优先。请合并或删除不需要的条目。
          </p>
        </div>
      </div>
      <ul className={`m-0 list-none space-y-2 pl-0 ${PANEL_TYPOGRAPHY.meta}`}>
        {groups.map((g) => (
          <li key={g.wrong} className="rounded-md bg-notion-bg/60 px-3 py-2">
            <span className="font-medium text-notion-text">「{g.wrong}」</span>
            <span className="text-notion-text-muted"> → </span>
            {g.entries.map((e, i) => (
              <span key={`${e.wrong}-${e.right}-${e.updatedAtMs}`}>
                {i > 0 ? " · " : null}
                {e.right}
                <span className="text-notion-text-light"> (hit {e.hitCount})</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
