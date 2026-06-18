import { describe, expect, it } from "vitest";
import { activityFeedKindLabel } from "./activityFeedKindLabel";

describe("activityFeedKindLabel", () => {
  it("maps structured kinds", () => {
    expect(activityFeedKindLabel("batch_transcribe")).toBe("批量转写");
    expect(activityFeedKindLabel("transcribe")).toBe("转写");
    expect(activityFeedKindLabel("export")).toBe("导出");
    expect(activityFeedKindLabel("edit_history")).toBe("编辑历史");
    expect(activityFeedKindLabel("generic")).toBeNull();
    expect(activityFeedKindLabel(undefined)).toBeNull();
  });
});
