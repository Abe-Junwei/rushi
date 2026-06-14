import { useEffect, useState } from "react";
import { logRuntimeParity } from "../services/runtimeParity";
import { resolveWaveformMountDeferTimeoutMs } from "../utils/waveformMountPolicy";

/** After timeout, allow decode mount while peaks ensure may still be in flight. */
export function useWaveformMountDeferTimeout(
  mediaUrl: string | null | undefined,
  deferRequested: boolean,
  mediaDurationSec: number,
): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
  }, [mediaUrl]);

  useEffect(() => {
    if (!deferRequested) {
      setTimedOut(false);
      return;
    }
    if (!mediaUrl) return;
    const timeoutMs = resolveWaveformMountDeferTimeoutMs(mediaDurationSec);
    const timer = window.setTimeout(() => {
      setTimedOut(true);
      logRuntimeParity(
        "waveform_mount",
        `defer_timeout_ms=${timeoutMs} fallback=decode`,
        "WARN",
      );
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [deferRequested, mediaDurationSec, mediaUrl]);

  return timedOut;
}
