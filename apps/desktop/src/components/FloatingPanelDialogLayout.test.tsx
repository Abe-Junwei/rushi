import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
} from "./FloatingPanelDialogLayout";

describe("FloatingPanelDialogLayout auto-fit", () => {
  it("Root fitToContent uses h-auto not h-full and clamps to parent", () => {
    const html = renderToStaticMarkup(
      <FloatingPanelDialogRoot fitToContent hasFooter>
        <span>body</span>
      </FloatingPanelDialogRoot>,
    );
    expect(html).toContain("h-auto");
    expect(html).toContain("max-h-full");
    expect(html.includes(" h-full") || html.includes('"h-full')).toBe(false);
  });

  it("ListRegion fitToContent can shrink so footer stays visible", () => {
    const html = renderToStaticMarkup(
      <FloatingPanelDialogListRegion fitToContent>
        <span>list</span>
      </FloatingPanelDialogListRegion>,
    );
    expect(html).toContain("grow");
    expect(html).toContain("shrink");
    expect(html).not.toContain("flex-1");
    expect(html).not.toContain("shrink-0");
  });

  it("ListRegion generous cap uses taller max-height", () => {
    const html = renderToStaticMarkup(
      <FloatingPanelDialogListRegion fitToContent autoFitListCap="generous">
        <span>list</span>
      </FloatingPanelDialogListRegion>,
    );
    expect(html).toContain("40rem");
    expect(html).toContain("65vh");
    expect(html).toContain("shrink");
  });
});
