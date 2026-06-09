import { describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { planDeliveryDocxExport } from "./exportDeliveryPlan";

vi.mock("./exportPolishDelivery", () => ({
  assessExportPolishReadiness: vi.fn(() => ({
    canExport: false,
    blockReason: "请先点击「生成预览」，确认修订后再导出。",
    previewCurrent: false,
  })),
}));

const segments: SegmentDto[] = [
  { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "第一句。" },
];

describe("planDeliveryDocxExport", () => {
  it("blocks LLM polish export without preview", () => {
    const plan = planDeliveryDocxExport({
      request: {
        mode: "clean",
        includeRevisionAppendix: false,
        llmPolish: true,
        polishPreview: null,
      },
      segments,
      editLogRows: [],
      currentFileId: "f1",
      exportMetaLine: undefined,
    });

    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.error).toContain("预览");
    }
  });

  it("allows clean export without polish", () => {
    const plan = planDeliveryDocxExport({
      request: {
        mode: "clean",
        includeRevisionAppendix: false,
        llmPolish: false,
      },
      segments,
      editLogRows: [],
      currentFileId: "f1",
      exportMetaLine: "meta",
    });

    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.docxOptions.exportMetaLine).toBe("meta");
      expect(plan.docxOptions.polishedParagraphs).toBeUndefined();
      expect(plan.recordEditLog).toEqual({ kind: "none" });
    }
  });
});
