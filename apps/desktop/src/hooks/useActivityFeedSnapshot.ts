import { useMemo, useSyncExternalStore } from "react";
import { getActivityFeedSnapshot, subscribeActivityFeed } from "../services/ui/activityFeed";

export function useActivityFeedSnapshot() {
  const feedItems = useSyncExternalStore(subscribeActivityFeed, getActivityFeedSnapshot, getActivityFeedSnapshot);
  const unreadFeedCount = useMemo(
    () => feedItems.filter((item) => !item.read).length,
    [feedItems],
  );
  return { feedItems, unreadFeedCount };
}
