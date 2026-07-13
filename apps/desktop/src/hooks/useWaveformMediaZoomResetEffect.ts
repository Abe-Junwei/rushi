import { useEffect, useRef, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  LONG_MEDIA_EDITING_DURATION_SEC,
  packableSegmentSpansSignature,
  resolveDefaultEditingPxPerSec,
  type DefaultEditingPxPerSecOptions,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { resolveTierViewportMetrics, type TierScrollLayoutMetrics, type TierScrollLiveRefs } from "../utils/waveformViewport";
import { writeStoredWaveformPxPerSecForMedia } from "../utils/waveformPrefs";
import { collectPackableSegmentSpansSec } from "../utils/waveformSegmentBounds";
import { peekFileViewRestoreForFile } from "../services/fileViewStateBridge";
import { shouldSkipMediaResetForFileViewRestore } from "./useFileViewStateRestoreEffect";

export function useWaveformMediaZoomResetEffect(args: {
  fileId: string | null;
  mediaUrl: string | null;
  mediaDurationSec: number;
  segments: readonly SegmentDto[];
  layoutIntent: WaveformZoomLayoutIntent;
  currentPxPerSec: number;
  tierScrollRef: RefObject<HTMLDivElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  resetZoomForMedia: (
    viewportWidthPx: number,
    durationSec: number,
    options?: DefaultEditingPxPerSecOptions,
  ) => void;
}) {
  const prevMediaUrlRef = useRef<string | null>(null);
  const pendingMediaZoomResetRef = useRef(false);
  const lastSpansSigRef = useRef("");
  const resetZoomForMediaRef = useRef(args.resetZoomForMedia);
  resetZoomForMediaRef.current = args.resetZoomForMedia;
  const layoutIntentRef = useRef(args.layoutIntent);
  layoutIntentRef.current = args.layoutIntent;
  const currentPxPerSecRef = useRef(args.currentPxPerSec);
  currentPxPerSecRef.current = args.currentPxPerSec;

  useEffect(() => {
    if (!args.mediaUrl) {
      prevMediaUrlRef.current = null;
      pendingMediaZoomResetRef.current = false;
      lastSpansSigRef.current = "";
      return;
    }
    if (prevMediaUrlRef.current !== null && prevMediaUrlRef.current !== args.mediaUrl) {
      pendingMediaZoomResetRef.current = true;
      lastSpansSigRef.current = "";
    }
    prevMediaUrlRef.current = args.mediaUrl;
  }, [args.mediaUrl]);

  useEffect(() => {
    if (!pendingMediaZoomResetRef.current || !args.mediaUrl) return;
    if (shouldSkipMediaResetForFileViewRestore(peekFileViewRestoreForFile(args.fileId), args.fileId)) {
      pendingMediaZoomResetRef.current = false;
      return;
    }
    const dur = args.mediaDurationSec;
    const { viewportWidthPx } = resolveTierViewportMetrics({
      tierScrollEl: args.tierScrollRef.current,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    if (dur < 0.5 || viewportWidthPx <= 0) return;
    pendingMediaZoomResetRef.current = false;
    const spans = collectPackableSegmentSpansSec(args.segments, dur);
    lastSpansSigRef.current = packableSegmentSpansSignature(spans);
    const options = spans.length > 0 ? { segmentSpansSec: spans } : undefined;
    resetZoomForMediaRef.current(viewportWidthPx, dur, options);
    writeStoredWaveformPxPerSecForMedia(viewportWidthPx, dur, options);
  }, [
    args.fileId,
    args.mediaUrl,
    args.mediaDurationSec,
    args.segments,
    args.tierScrollRef,
    args.tierScrollLive,
    args.tierScrollLayout,
  ]);

  // Long-media route D: when packable spans arrive/change and intent is still default, refit.
  useEffect(() => {
    if (!args.mediaUrl) return;
    if (layoutIntentRef.current !== "default") return;
    if (args.mediaDurationSec < LONG_MEDIA_EDITING_DURATION_SEC) return;
    if (shouldSkipMediaResetForFileViewRestore(peekFileViewRestoreForFile(args.fileId), args.fileId)) {
      return;
    }
    const dur = args.mediaDurationSec;
    const spans = collectPackableSegmentSpansSec(args.segments, dur);
    const sig = packableSegmentSpansSignature(spans);
    if (!sig || sig === lastSpansSigRef.current) return;
    const { viewportWidthPx } = resolveTierViewportMetrics({
      tierScrollEl: args.tierScrollRef.current,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    if (viewportWidthPx <= 0) return;
    const options = { segmentSpansSec: spans };
    const target = resolveDefaultEditingPxPerSec(viewportWidthPx, dur, options);
    const tol = Math.max(0.001, target * 0.01);
    if (Math.abs(currentPxPerSecRef.current - target) <= tol) {
      lastSpansSigRef.current = sig;
      return;
    }
    // First packable set for this media (or after media URL clear): auto-refit.
    // Later span edits while still on default do not chase — user can hit Reset.
    if (lastSpansSigRef.current !== "") {
      lastSpansSigRef.current = sig;
      return;
    }
    lastSpansSigRef.current = sig;
    resetZoomForMediaRef.current(viewportWidthPx, dur, options);
    writeStoredWaveformPxPerSecForMedia(viewportWidthPx, dur, options);
  }, [
    args.fileId,
    args.mediaUrl,
    args.mediaDurationSec,
    args.segments,
    args.layoutIntent,
    args.tierScrollRef,
    args.tierScrollLive,
    args.tierScrollLayout,
  ]);
}
