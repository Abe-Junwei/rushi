import { useMemo, useSyncExternalStore } from "react";
import {
  getActivityFeedSnapshot,
  getActivityFeedUnreadCount,
  subscribeActivityFeed,
} from "../services/ui/activityFeed";

export function useActivityFeedSnapshot() {
  const feedItems = useSyncExternalStore(subscribeActivityFeed, getActivityFeedSnapshot, getActivityFeedSnapshot);
  const unreadFeedCount = useMemo(() => getActivityFeedUnreadCount(), [feedItems]);
  return { feedItems, unreadFeedCount };
}
