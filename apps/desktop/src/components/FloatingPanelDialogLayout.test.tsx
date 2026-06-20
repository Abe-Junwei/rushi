import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
} from "./FloatingPanelDialogLayout";

describe("FloatingPanelDialogLayout auto-fit", () => {
  it("Root fitToContent uses h-auto not h-full", () => {
    const html = renderToStaticMarkup(
      <FloatingPanelDialogRoot fitToContent hasFooter>
        <span>body</span>
      </FloatingPanelDialogRoot>,
    );
    expect(html).toContain("h-auto");
    expect(html).not.toMatch(/\bh-full\b/);
  });

  it("ListRegion fitToContent avoids flex-1 growth", () => {
    const html = renderToStaticMarkup(
      <FloatingPanelDialogListRegion fitToContent>
        <span>list</span>
      </FloatingPanelDialogListRegion>,
    );
    expect(html).toContain("shrink-0");
    expect(html).not.toContain("flex-1");
  });
});
