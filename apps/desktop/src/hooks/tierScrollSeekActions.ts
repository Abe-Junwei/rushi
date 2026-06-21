import type { MutableRefObject, RefObject } from "react";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import type { useProjectWaveform } from "./useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

export type TierScrollSeekActionArgs = {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  timelineWidthPx: number;
  mediaDurationSec: number;
  wfApiRef: MutableRefObject<WfApi>;
};

export function seekFromTierClientX(args: TierScrollSeekActionArgs, clientX: number): void {
  const w = args.wfApiRef.current;
  const d = args.mediaDurationSec;
  if (!w.isReady || d <= 0) return;
  w.seek(w.clientXToTimeSec(clientX));
}

export function centerTierAtClientX(
  args: TierScrollSeekActionArgs,
  clientX: number,
  setTierScrollImmediate: (scrollLeftPx: number) => void,
): void {
  const w = args.wfApiRef.current;
  const d = args.mediaDurationSec;
  if (!w.isReady || d <= 0) return;
  const tier = args.tierScrollRef.current;
  if (!tier) return;
  const timeSec = w.clientXToTimeSec(clientX);
  const targetScroll = scrollPxCenterTimeInViewport({
    timeSec,
    timelineWidthPx: Math.max(args.timelineWidthPx, 1),
    durationSec: d,
    viewportWidthPx: tier.clientWidth,
  });
  setTierScrollImmediate(targetScroll);
}

export function pickAbsoluteTimeInTierViewport(
  args: TierScrollSeekActionArgs,
  timeSec: number,
  mode: "seek" | "seekAndCenterViewport",
  setTierScrollImmediate: (scrollLeftPx: number) => void,
): void {
  const w = args.wfApiRef.current;
  const d = args.mediaDurationSec;
  if (d <= 0) return;
  const clamped = Math.max(0, Math.min(d, timeSec));
  w.seek(clamped);
  if (mode !== "seekAndCenterViewport") return;
  const tier = args.tierScrollRef.current;
  if (!tier) return;
  const targetScroll = scrollPxCenterTimeInViewport({
    timeSec: clamped,
    timelineWidthPx: Math.max(args.timelineWidthPx, 1),
    durationSec: d,
    viewportWidthPx: tier.clientWidth,
  });
  setTierScrollImmediate(targetScroll);
}
