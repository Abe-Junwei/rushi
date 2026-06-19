import type { ActivityFeedItem } from "./activityFeed";
import { activityFeedKindLabel } from "./activityFeedKindLabel";

export function formatActivityRelativeTime(at: number, now = Date.now()): string {
  const deltaMs = now - at;
  if (deltaMs < 60_000) return "刚刚";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function resolveActivityKindLabel(item: ActivityFeedItem): string | null {
  return activityFeedKindLabel(item.kind);
}

export function resolveActivityContextLabel(item: ActivityFeedItem): string | null {
  const label = item.fileLabel?.trim();
  if (!label) return null;
  if (item.message.includes(label)) return null;
  return label;
}

/**
 * 行 typography 真源（与文案 `<p>` 一致）。
 * 对齐必须用同一上下文下的 `1lh`，禁止 rem 估算或 inline align-middle + translate 叠加。
 */
export const ACTIVITY_FEED_ROW_TEXT_CLASS = "text-sm leading-snug";

/** 6px 圆点本体 */
export const ACTIVITY_FEED_STATUS_MARK_CLASS = "block size-1.5 shrink-0 rounded-full";

/**
 * 首行槽：高度 = 1lh（继承 ACTIVITY_FEED_ROW_TEXT_CLASS），mark 在槽内 flex 居中。
 * 仅绑定首行；meta 在下一行，不参与槽高。
 */
export const ACTIVITY_FEED_MARK_CELL_CLASS = `flex shrink-0 items-center justify-center self-start h-[1lh] ${ACTIVITY_FEED_ROW_TEXT_CLASS}`;

export const ACTIVITY_FEED_DOT_CELL_CLASS = `${ACTIVITY_FEED_MARK_CELL_CLASS} w-1.5`;

export const ACTIVITY_FEED_ACTION_CELL_CLASS = `${ACTIVITY_FEED_MARK_CELL_CLASS} w-4`;

/** 无 Preflight 时清零 `<p>` 默认 margin，避免侧栏 mark 与文案首行错位 */
export const ACTIVITY_FEED_MESSAGE_CLASS = "m-0";

export function activityFeedRowSurfaceClass(read: boolean): string {
  return read
    ? "px-2 py-0.5 hover:bg-notion-sidebar-hover"
    : "bg-notion-sidebar-hover/30 px-2 py-0.5 hover:bg-notion-sidebar-hover";
}
