import { ACTIVITY_FEED_MAX_ITEMS } from "../services/ui/activityFeed";
import type { ActivityFeedItem } from "../services/ui/activityFeed";
import { WelcomeActivityFeedRow } from "./WelcomeActivityFeedRow";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-0.5 text-label font-medium leading-none text-notion-text-light">{children}</p>
  );
}

type Props = {
  feedItems: readonly ActivityFeedItem[];
  unreadFeedCount: number;
  onActivityAction: (item: ActivityFeedItem) => void;
};

export function WelcomeActivityFeedSection({
  feedItems,
  unreadFeedCount,
  onActivityAction,
}: Props) {
  if (feedItems.length === 0) return null;

  return (
    <section aria-label="最近提醒">
      <SectionLabel>
        最近提醒
        {unreadFeedCount > 0 ? (
          <span className="ml-1 font-normal text-notion-text-muted">({unreadFeedCount})</span>
        ) : null}
      </SectionLabel>
      <ul className="m-0 list-none p-0">
        {feedItems.map((item) => (
          <WelcomeActivityFeedRow key={item.id} item={item} onAction={onActivityAction} />
        ))}
      </ul>
    </section>
  );
}

export function WelcomeActivityFeedFooter({
  feedItems,
  hasOnboarding,
  activityHint,
}: {
  feedItems: readonly ActivityFeedItem[];
  hasOnboarding: boolean;
  activityHint: string | null;
}) {
  const showFooter = hasOnboarding || feedItems.length > 0;
  if (!showFooter) return null;

  return (
    <div className="border-t border-notion-border px-2 py-1 text-label leading-tight text-notion-text-muted">
      {feedItems.length > 0 ? (
        <span>
          保留最近 {ACTIVITY_FEED_MAX_ITEMS} 条
          {feedItems.length > 0 ? ` · 共 ${feedItems.length} 条` : ""}
        </span>
      ) : (
        <span>完成上手步骤后可关闭此提示</span>
      )}
      <span className="text-notion-text-light" aria-hidden>
        {" "}
        ·{" "}
      </span>
      <span>{activityHint} 开关收件箱</span>
    </div>
  );
}
