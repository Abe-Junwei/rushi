import { describe, expect, it } from "vitest";
import type { ActivityFeedItem } from "./activityFeed";
import {
  ACTIVITY_FEED_DOT_CELL_CLASS,
  ACTIVITY_FEED_MESSAGE_CLASS,
  ACTIVITY_FEED_ROW_TEXT_CLASS,
  formatActivityRelativeTime,
  resolveActivityContextLabel,
} from "./activityFeedPresentation";

function item(partial: Partial<ActivityFeedItem>): ActivityFeedItem {
  return {
    id: "1",
    variant: "success",
    message: "转写完成",
    at: 1_700_000_000_000,
    read: false,
    ...partial,
  };
}

describe("activityFeedPresentation", () => {
  it("formats relative time", () => {
    const now = 1_700_000_060_000;
    expect(formatActivityRelativeTime(now - 30_000, now)).toBe("刚刚");
    expect(formatActivityRelativeTime(now - 120_000, now)).toBe("2 分钟前");
  });

  it("hides context label when already in message", () => {
    expect(
      resolveActivityContextLabel(
        item({ fileLabel: "访谈.wav", message: "批量转写失败：访谈.wav 超时" }),
      ),
    ).toBeNull();
    expect(
      resolveActivityContextLabel(item({ fileLabel: "访谈.wav", message: "批量转写失败：超时" })),
    ).toBe("访谈.wav");
  });

  it("aligns status mark via shared 1lh gutter (no inline translate hacks)", () => {
    expect(ACTIVITY_FEED_ROW_TEXT_CLASS).toContain("leading-snug");
    expect(ACTIVITY_FEED_DOT_CELL_CLASS).toContain("h-[1lh]");
    expect(ACTIVITY_FEED_DOT_CELL_CLASS).toContain(ACTIVITY_FEED_ROW_TEXT_CLASS);
    expect(ACTIVITY_FEED_DOT_CELL_CLASS).not.toMatch(/translate-y|align-middle/);
    expect(ACTIVITY_FEED_MESSAGE_CLASS).toContain("m-0");
  });
});
