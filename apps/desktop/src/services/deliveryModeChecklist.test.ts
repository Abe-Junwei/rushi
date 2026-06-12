import { describe, expect, it } from "vitest";
import {
  buildDeliveryFinalChecklist,
  deliveryFinalChecklistBlockingReason,
  deliveryFinalChecklistReady,
} from "./deliveryModeChecklist";
import type { SegmentDto } from "../tauri/projectApi";

function seg(text: string): SegmentDto {
  return {
    uid: "u1",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    text_stage: "auto_transcribe",
  };
}

describe("deliveryModeChecklist", () => {
  it("blocks when no segment text", () => {
    const items = buildDeliveryFinalChecklist({
      segments: [seg("")],
      hasRecordedMetadata: false,
    });
    expect(deliveryFinalChecklistReady(items)).toBe(false);
    expect(deliveryFinalChecklistBlockingReason(items)).toMatch(/语段均为空/);
  });

  it("passes with text even without metadata", () => {
    const items = buildDeliveryFinalChecklist({
      segments: [seg("hello")],
      hasRecordedMetadata: false,
    });
    expect(deliveryFinalChecklistReady(items)).toBe(true);
  });
});
