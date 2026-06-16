import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import type { WaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

export type ProjectWaveformMountRefs = {
  optsRef: MutableRefObject<UseProjectWaveformOptions>;
  containerRef: RefObject<HTMLDivElement | null>;
  wsRef: MutableRefObject<WaveSurfer | null>;
  wsUnsubsRef: MutableRefObject<Array<() => void>>;
  minPxPerSecRef: MutableRefObject<number>;
  peakCacheRef: MutableRefObject<PeakCache | null>;
  layoutDurationSecRef: MutableRefObject<number>;
  waveformHeightRef: MutableRefObject<number>;
  appliedWaveformHeightRef: MutableRefObject<number>;
  pendingAppliedWaveformHeightRef: MutableRefObject<number | null>;
  appliedZoom: WaveformAppliedZoomState;
  syncTierScrollAfterRenderRef: MutableRefObject<() => void>;
  lastTimeUiCommitRef: MutableRefObject<number>;
  lastTimeUiCommitMsRef: MutableRefObject<number>;
  scrollNotifyRafRef: MutableRefObject<number>;
  pendingScrollLeftRef: MutableRefObject<number>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setDuration: Dispatch<SetStateAction<number>>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
};

export async function waitForWaveformContainer(
  readContainer: () => HTMLDivElement | null,
  isDisposed: () => boolean,
  maxAttempts = 60,
): Promise<HTMLDivElement | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isDisposed()) return null;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    const el = readContainer();
    if (el?.isConnected) return el;
  }
  return null;
}
