import { useEffect, useRef, type RefObject } from "react";
import { resolveTierViewportMetrics, type TierScrollLayoutMetrics, type TierScrollLiveRefs } from "../utils/waveformViewport";
import { writeStoredWaveformPxPerSecForMedia } from "../utils/waveformPrefs";

export function useWaveformMediaZoomResetEffect(args: {
  mediaUrl: string | null;
  mediaDurationSec: number;
  tierScrollRef: RefObject<HTMLDivElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  resetZoomForMedia: (viewportWidthPx: number, durationSec: number) => void;
}) {
  const prevMediaUrlRef = useRef<string | null>(null);
  const pendingMediaZoomResetRef = useRef(false);
  const resetZoomForMediaRef = useRef(args.resetZoomForMedia);
  resetZoomForMediaRef.current = args.resetZoomForMedia;

  useEffect(() => {
    if (!args.mediaUrl) {
      prevMediaUrlRef.current = null;
      pendingMediaZoomResetRef.current = false;
      return;
    }
    if (prevMediaUrlRef.current !== null && prevMediaUrlRef.current !== args.mediaUrl) {
      pendingMediaZoomResetRef.current = true;
    }
    prevMediaUrlRef.current = args.mediaUrl;
  }, [args.mediaUrl]);

  useEffect(() => {
    if (!pendingMediaZoomResetRef.current || !args.mediaUrl) return;
    const dur = args.mediaDurationSec;
    const { viewportWidthPx } = resolveTierViewportMetrics({
      tierScrollEl: args.tierScrollRef.current,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    if (dur < 0.5 || viewportWidthPx <= 0) return;
    pendingMediaZoomResetRef.current = false;
    resetZoomForMediaRef.current(viewportWidthPx, dur);
    writeStoredWaveformPxPerSecForMedia(viewportWidthPx, dur);
  }, [
    args.mediaUrl,
    args.mediaDurationSec,
    args.tierScrollRef,
    args.tierScrollLive,
    args.tierScrollLayout,
  ]);
}
