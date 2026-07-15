import { describe, expect, it } from "vitest";
import { dialogPanelTitleBarHint } from "./dialogPanelHints";

describe("dialogPanelHints", () => {
  it("includes resize hint for manual-height panels", () => {
    expect(dialogPanelTitleBarHint(false)).toContain("拖边或角调整大小");
    expect(dialogPanelTitleBarHint(false)).not.toContain("双击");
  });

  it("includes restore auto height for auto-fit panels", () => {
    expect(dialogPanelTitleBarHint(true)).toContain("双击恢复自动高度");
    expect(dialogPanelTitleBarHint(true)).toContain("拖边或角调整大小");
  });
});
