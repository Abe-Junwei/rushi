import { describe, expect, it, beforeEach } from "vitest";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentLearnButtonVisible,
  shouldRetainDraftForPendingLearn,
} from "./segmentLearnVisibility";

function seg(text: string): SegmentDto {
  return { uid: "u1", idx: 0, start_sec: 0, end_sec: 1, text };
}

describe("segmentLearnVisibility", () => {
  beforeEach(() => {
    segmentDraftStore.resetAll();
  });

  it("shows button via applyLearnEditFromDomInput (WebView path)", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const start = baseline.indexOf("山通");
    const end = start + 2;
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    segmentDraftStore.applyLearnEditFromDomInput(key, baseline, { value: baseline, start, end }, afterDel);
    const live = "尤其是禅宗道场";
    segmentDraftStore.applyLearnEditFromDomInput(
      key,
      baseline,
      { value: afterDel, start, end: start },
      live,
    );
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("shows button after tracked replace while draft holds live text", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const start = baseline.indexOf("山通");
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      baseline,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "禅宗",
    );
    const live = "尤其是禅宗道场";
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("shows button for delete then type via DOM (视死→誓死)", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditFromDomInput(key, baseline, { value: baseline, start, end }, afterDel);
    segmentDraftStore.applyLearnEditFromDomInput(
      key,
      baseline,
      { value: afterDel, start, end: start },
      live,
    );
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("shows button after delete then IME path (endComposition keeps active op)", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditFromDomInput(key, baseline, { value: baseline, start, end }, afterDel);
    segmentDraftStore.beginComposition(key, baseline, afterDel, start, start);
    segmentDraftStore.endComposition(key);
    segmentDraftStore.applyLearnEditFromDomInput(
      key,
      baseline,
      { value: afterDel, start, end: start },
      live,
    );
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("finalize after delete still shows button once insert completes (baseline sync)", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditFromDomInput(key, baseline, { value: baseline, start, end }, afterDel);
    segmentDraftStore.finalizeActiveLearnEditOp(key);
    segmentDraftStore.applyLearnEditFromDomInput(
      key,
      baseline,
      { value: afterDel, start, end: start },
      live,
    );
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("retains draft on blur when learnable ops exist", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const start = baseline.indexOf("山通");
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      baseline,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "禅宗",
    );
    const live = "尤其是禅宗道场";
    expect(shouldRetainDraftForPendingLearn(key, baseline, live)).toBe(true);
  });

  it("shows button for 视死→誓死 when committed lags (draft retained)", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      baseline,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死",
    );
    segmentDraftStore.setDraft(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("draft clear while committed lags hides button (regression guard)", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      baseline,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死",
    );
    segmentDraftStore.setDraft(key, live);
    segmentDraftStore.clearDraft(key);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(false);
  });

  it("preserves learn session when re-selecting row with pending draft", () => {
    const row = seg("只有这种视死悟道的决心。");
    const key = segmentDraftKey(row, 0);
    const baseline = row.text;
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    segmentDraftStore.setLearnFocusBaseline(key, baseline);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      baseline,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死",
    );
    segmentDraftStore.setDraft(key, live);
    segmentDraftStore.beginSegmentLearnSession(key, live);
    expect(segmentLearnButtonVisible(key, baseline, true)).toBe(true);
  });

  it("does not show button without learn tracking", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    segmentDraftStore.setLearnFocusBaseline(key, row.text);
    segmentDraftStore.setDraft(key, "尤其是禅宗道场");
    expect(segmentLearnButtonVisible(key, row.text, true)).toBe(false);
  });
});
