import { describe, expect, it } from "vitest";
import { computeRevisionSpans, listRevisionChanges } from "./revisionDiff";

describe("computeRevisionSpans", () => {
  it("listRevisionChanges splits non-adjacent edits into separate items", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    const live = "如果这个里面有二十个里面有二十个师傅来回。";
    expect(listRevisionChanges(baseline, live)).toEqual([
      { removed: "展场", inserted: "" },
      { removed: "扳手", inserted: "" },
    ]);
  });

  it("splits two non-adjacent deletions without linking middle text", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    const live = "如果这个里面有二十个里面有二十个师傅来回。";
    const spans = computeRevisionSpans(baseline, live);
    expect(spans).toEqual([
      { kind: "equal", text: "如果这个" },
      { kind: "delete", text: "展场" },
      { kind: "equal", text: "里面有二十个" },
      { kind: "delete", text: "扳手" },
      { kind: "equal", text: "里面有二十个师傅来回。" },
    ]);
  });

  it("keeps disjoint deletions visible when typing a replacement", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    const live = "如果这个新里面有二十个里面有二十个师傅来回。";
    const spans = computeRevisionSpans(baseline, live);
    expect(spans.some((s) => s.kind === "delete" && s.text.includes("展"))).toBe(true);
    expect(spans.some((s) => s.kind === "delete" && s.text === "扳手")).toBe(true);
    expect(spans.some((s) => s.kind === "insert" && s.text === "新")).toBe(true);
  });

  it("does not swallow unchanged char between replace (一千→一天)", () => {
    const spans = computeRevisionSpans("我们一千年前", "我们一天前");
    expect(spans).toEqual([
      { kind: "equal", text: "我们一" },
      { kind: "delete", text: "千" },
      { kind: "insert", text: "天" },
      { kind: "equal", text: "年前" },
    ]);
  });

  it("misaligns shared suffix char into equal span for 二六十中→而六时中", () => {
    const baseline = "尤其在二六十中道场";
    const live = "尤其在而六时中道场";
    expect(computeRevisionSpans(baseline, live)).toEqual([
      { kind: "equal", text: "尤其在" },
      { kind: "insert", text: "而" },
      { kind: "delete", text: "二" },
      { kind: "equal", text: "六" },
      { kind: "insert", text: "时" },
      { kind: "delete", text: "十" },
      { kind: "equal", text: "中道场" },
    ]);
  });
});
