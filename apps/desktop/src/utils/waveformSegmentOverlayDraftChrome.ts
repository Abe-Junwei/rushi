import type { RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { clearCspLayoutRules, setCspLayoutRules } from "./cspElementLayout";
import { waveformRegionFillColor } from "./segmentChrome";
import { segmentOverlayGeometry } from "./waveformSegmentBounds";
import type { SegmentOverlayDraft } from "./waveformSegmentOverlayGeometry";

export const WAVEFORM_SEGMENT_DRAFT_LAYOUT_OWNER = "waveform-segment-draft-layout";

export function overlayRootFromCreatePreview(createPreviewRef: RefObject<HTMLElement | null>): ParentNode | null {
  return createPreviewRef.current?.closest(".waveform-segment-overlay") ?? null;
}

export function overlaySegmentNode(root: ParentNode | null, idx: number | null): HTMLElement | null {
  if (!root || idx == null) return null;
  const el = root.querySelector(`[data-segment-idx="${idx}"]`);
  return el instanceof HTMLElement ? el : null;
}

export function hidePreviewFallback(previewEl: HTMLElement | null): void {
  if (previewEl) setCspLayoutRules(previewEl, { display: "none" });
}

export function hideSegmentDraftPreviewFallbackIfOverlayMounted(
  previewEl: HTMLElement | null,
  draftIdx: number | null,
): boolean {
  const overlayRoot = previewEl?.closest(".waveform-segment-overlay") ?? null;
  if (!overlaySegmentNode(overlayRoot, draftIdx)) return false;
  hidePreviewFallback(previewEl);
  return true;
}

export function applySegmentDraftOverlayImperative(
  draft: SegmentOverlayDraft,
  args: {
    segments: SegmentDto[];
    timelineWidthPx: number;
    durationSec: number;
    layoutHeightPx: number;
    laneByIndex: number[];
    laneCount: number;
  },
  overlayRoot: ParentNode | null,
): boolean {
  const el = overlaySegmentNode(overlayRoot, draft.idx);
  if (!el) return false;
  const geom = segmentOverlayGeometry({
    startSec: draft.startSec,
    endSec: draft.endSec,
    timelineWidthPx: args.timelineWidthPx,
    durationSec: args.durationSec,
    lane: args.laneByIndex[draft.idx] ?? 0,
    laneCount: args.laneCount,
    containerHeightPx: args.layoutHeightPx,
  });
  setCspLayoutRules(
    el,
    {
      left: geom.leftPx,
      width: geom.widthPx,
      top: geom.topPx,
      height: geom.heightPx,
    },
    WAVEFORM_SEGMENT_DRAFT_LAYOUT_OWNER,
  );
  return true;
}

export function clearSegmentDraftOverlayLayout(
  idx: number | null,
  overlayRoot: ParentNode | null,
): void {
  const el = overlaySegmentNode(overlayRoot, idx);
  if (el) clearCspLayoutRules(el, WAVEFORM_SEGMENT_DRAFT_LAYOUT_OWNER);
}

export function applySegmentDraftPreviewFallback(
  draft: SegmentOverlayDraft,
  args: {
    segments: SegmentDto[];
    timelineWidthPx: number;
    durationSec: number;
    layoutHeightPx: number;
    laneByIndex: number[];
    laneCount: number;
  },
  previewEl: HTMLElement | null,
): void {
  const seg = args.segments[draft.idx];
  if (!previewEl || !seg) return;
  const geom = segmentOverlayGeometry({
    startSec: draft.startSec,
    endSec: draft.endSec,
    timelineWidthPx: args.timelineWidthPx,
    durationSec: args.durationSec,
    lane: args.laneByIndex[draft.idx] ?? 0,
    laneCount: args.laneCount,
    containerHeightPx: args.layoutHeightPx,
  });
  setCspLayoutRules(previewEl, {
    display: "block",
    left: geom.leftPx,
    width: geom.widthPx,
    top: geom.topPx,
    height: geom.heightPx,
    bottom: null,
    background: waveformRegionFillColor(seg, true),
    border: "none",
    borderLeft: "none",
    borderRight: "none",
    zIndex: 4,
  });
}
