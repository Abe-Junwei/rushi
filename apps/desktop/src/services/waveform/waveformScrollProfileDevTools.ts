import {
  emitWaveformScrollProfileLine,
  isWaveformScrollProfileEnabled,
  readWaveformScrollProfileCounters,
  readWaveformScrollProfileRecentLines,
  resetWaveformScrollProfileCounters,
  setWaveformScrollProfileEnabled,
  startWaveformScrollProfileAutoTick,
  stopWaveformScrollProfileAutoTick,
  type ScrollProfileCounters,
} from "./waveformScrollProfile";

export function installWaveformScrollProfileDevTools(): void {
  if (typeof window === "undefined") return;
  const api = {
    help: () => {
      const message = [
        "1. __rushiScrollProfile.enable()",
        "2. 打开 Editor，播放/横滚/缩放波形",
        "3. __rushiScrollProfile.print() 或 __rushiScrollProfile.recent()",
        "audioTicks≈60 且 playbackFrames低 = 本仓调度慢；audioTicks低 = 上游/rAF被饿住",
      ].join("\n");
      // eslint-disable-next-line no-console -- dev-only
      console.info(message);
      return { message };
    },
    enable: () => {
      setWaveformScrollProfileEnabled(true);
      resetWaveformScrollProfileCounters();
      startWaveformScrollProfileAutoTick();
      const message =
        "[scroll-profile] enabled — play/scroll waveform; per-second + burst summaries log to console & desktop.log";
      emitWaveformScrollProfileLine(message);
      return {
        enabled: true,
        message,
        next: "play/scroll/zoom waveform then __rushiScrollProfile.print()",
      };
    },
    disable: () => {
      stopWaveformScrollProfileAutoTick();
      setWaveformScrollProfileEnabled(false);
      resetWaveformScrollProfileCounters();
      const message = "[scroll-profile] disabled";
      emitWaveformScrollProfileLine(message);
      return { enabled: false, message };
    },
    enabled: () => isWaveformScrollProfileEnabled(),
    counters: () => readWaveformScrollProfileCounters(),
    recent: () => readWaveformScrollProfileRecentLines(),
    print: () => {
      const lines = readWaveformScrollProfileRecentLines();
      const counters = readWaveformScrollProfileCounters();
      if (lines.length === 0) {
        const message =
          "[scroll-profile] (no lines yet — enable(), play/scroll/zoom waveform, then print again)";
        // eslint-disable-next-line no-console -- dev-only
        console.info(message);
        return { lines: [] as string[], message, counters };
      }
      for (const line of lines) {
        // eslint-disable-next-line no-console -- dev-only
        console.info(line);
      }
      return { lines, counters };
    },
    reset: () => {
      resetWaveformScrollProfileCounters();
      return { ok: true, counters: readWaveformScrollProfileCounters() };
    },
  };
  Object.defineProperty(window, "__rushiScrollProfile", {
    value: api,
    configurable: true,
    writable: true,
  });
  if (isWaveformScrollProfileEnabled()) {
    startWaveformScrollProfileAutoTick();
  }
}

declare global {
  interface Window {
    __rushiScrollProfile?: {
      help: () => { message: string };
      enable: () => { enabled: true; message: string; next: string };
      disable: () => { enabled: false; message: string };
      enabled: () => boolean;
      counters: () => ScrollProfileCounters;
      recent: () => string[];
      print: () => { lines: string[]; message?: string; counters: ScrollProfileCounters };
      reset: () => { ok: true; counters: ScrollProfileCounters };
    };
  }
}
