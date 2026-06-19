import { Check } from "lucide-react";
import { CONTROL_BTN_LINK } from "../config/controlStyles";
import type { ActivityFeedItem } from "../services/ui/activityFeed";
import {
  ACTIVITY_FEED_ACTION_CELL_CLASS,
  ACTIVITY_FEED_DOT_CELL_CLASS,
  ACTIVITY_FEED_MESSAGE_CLASS,
  ACTIVITY_FEED_ROW_TEXT_CLASS,
  ACTIVITY_FEED_STATUS_MARK_CLASS,
  activityFeedRowSurfaceClass,
  formatActivityRelativeTime,
  resolveActivityContextLabel,
  resolveActivityKindLabel,
} from "../services/ui/activityFeedPresentation";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function variantDotClass(variant: ActivityFeedItem["variant"]): string {
  switch (variant) {
    case "success":
      return "bg-zen-success";
    case "warning":
      return "bg-zen-status-warn";
    default:
      return "bg-zen-cinnabar";
  }
}

function MetaDot() {
  return (
    <span className="text-notion-text-light" aria-hidden>
      ·
    </span>
  );
}

type Props = {
  item: ActivityFeedItem;
  onAction: (item: ActivityFeedItem) => void;
};

export function WelcomeActivityFeedRow({ item, onAction }: Props) {
  const kindLabel = resolveActivityKindLabel(item);
  const contextLabel = resolveActivityContextLabel(item);
  const timeLabel = formatActivityRelativeTime(item.at);

  return (
    <li className={activityFeedRowSurfaceClass(item.read)}>
      <div className={`flex items-start gap-1.5 ${ACTIVITY_FEED_ROW_TEXT_CLASS}`}>
        <span className={ACTIVITY_FEED_DOT_CELL_CLASS} aria-hidden>
          <span className={`${ACTIVITY_FEED_STATUS_MARK_CLASS} ${variantDotClass(item.variant)}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`${ACTIVITY_FEED_MESSAGE_CLASS} ${item.read ? "text-notion-text" : "font-medium text-notion-text"}`}
          >
            {item.message}
          </p>
          <div className="mt-px flex min-w-0 flex-wrap items-center gap-x-1 text-label leading-tight text-notion-text-muted">
            {kindLabel ? (
              <span className="shrink-0 rounded bg-notion-sidebar-hover px-1 py-px text-notion-text-muted">
                {kindLabel}
              </span>
            ) : null}
            {contextLabel ? (
              <span className="max-w-[11rem] truncate" title={contextLabel}>
                {contextLabel}
              </span>
            ) : null}
            {contextLabel || kindLabel ? <MetaDot /> : null}
            <span className="shrink-0">{timeLabel}</span>
            {item.actionLabel ? (
              <>
                <MetaDot />
                <button
                  type="button"
                  className={`${CONTROL_BTN_LINK} -my-0.5 inline shrink-0 px-0 py-0 text-label leading-tight`}
                  onClick={() => onAction(item)}
                >
                  {item.actionLabel}
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className={ACTIVITY_FEED_ACTION_CELL_CLASS}>
          {item.read ? (
            <Check
              className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-notion-text-light`}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zen-cinnabar" aria-label="未读" />
          )}
        </div>
      </div>
    </li>
  );
}
