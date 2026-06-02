import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PendingLearnDiffText } from "./PendingLearnDiffText";

describe("PendingLearnDiffText", () => {
  it("renders disjoint deletions with equal spans between", () => {
    const html = renderToStaticMarkup(
      <PendingLearnDiffText
        before="如果这个展场里面有二十个扳手里面有二十个师傅来回。"
        after="如果这个里面有二十个里面有二十个师傅来回。"
      />,
    );
    expect(html).toContain("seg-learn-diff-removed");
    expect(html).toContain("展场");
    expect(html).toContain("扳手");
    expect(html).toContain("里面有二十个");
    expect(html).not.toContain("removed-ghost");
  });
});
