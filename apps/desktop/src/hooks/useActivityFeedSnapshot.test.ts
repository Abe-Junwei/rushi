import { describe, expect, it, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActivityFeedSnapshot } from "./useActivityFeedSnapshot";
import {
  clearActivityFeedForTests,
  markActivityFeedRead,
  pushActivityFeedItem,
} from "../services/ui/activityFeed";

describe("useActivityFeedSnapshot", () => {
  afterEach(() => {
    clearActivityFeedForTests();
  });

  it("updates unreadFeedCount when feed changes", () => {
    const { result } = renderHook(() => useActivityFeedSnapshot());

    expect(result.current.unreadFeedCount).toBe(0);

    act(() => {
      pushActivityFeedItem({ variant: "success", message: "导入完成" });
    });
    expect(result.current.unreadFeedCount).toBe(1);

    act(() => {
      markActivityFeedRead();
    });
    expect(result.current.unreadFeedCount).toBe(0);
  });
});
