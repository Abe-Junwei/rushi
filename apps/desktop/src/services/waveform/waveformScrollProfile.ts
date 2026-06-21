/** Dev-only tier scroll / band canvas frame counters (localStorage gate). */

export const WAVEFORM_SCROLL_PROFILE_STORAGE_KEY = "rushi.dev.waveformScrollProfile";

const RECENT_LINES_MAX = 48;

type ScrollProfileCounters = {
  tierFrames: number;
  bandSkipped: number;
  bandRepaint: number;
  bandCspLeftWrites: number;
  minimapViewportWrites: number;
  rulerSkipped: number;
  rulerRepaint: number;
  rulerCspLeftWrites: number;
};

let enabled = false;
let burstActive = false;
let burstStartedAt = 0;
const counters: ScrollProfileCounters = {
  tierFrames: 0,
  bandSkipped: 0,
  bandRepaint: 0,
  bandCspLeftWrites: 0,
  minimapViewportWrites: 0,
  rulerSkipped: 0,
  rulerRepaint: 0,
  rulerCspLeftWrites: 0,
};
const recentLines: string[] = [];

function emitLine(line: string): void {
  recentLines.push(line);
  if (recentLines.length > RECENT_LINES_MAX) recentLines.shift();
  if (typeof console !== "undefined" && typeof console.info === "function") {
    // eslint-disable-next-line no-console -- dev-only scroll profile
    console.info(line);
  }
}

export function isWaveformScrollProfileEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabled) return true;
  try {
    return window.localStorage.getItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWaveformScrollProfileEnabled(next: boolean): void {
  enabled = next;
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function resetWaveformScrollProfileCounters(): void {
  counters.tierFrames = 0;
  counters.bandSkipped = 0;
  counters.bandRepaint = 0;
  counters.bandCspLeftWrites = 0;
  counters.minimapViewportWrites = 0;
  counters.rulerSkipped = 0;
  counters.rulerRepaint = 0;
  counters.rulerCspLeftWrites = 0;
  burstActive = false;
  burstStartedAt = 0;
}

export function waveformScrollProfileBeginBurst(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  if (!burstActive) {
    burstActive = true;
    burstStartedAt = performance.now();
  }
  counters.tierFrames += 1;
}

export function waveformScrollProfileBandSkipped(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.bandSkipped += 1;
}

export function waveformScrollProfileBandRepaint(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.bandRepaint += 1;
  if (cspLeftWrite) counters.bandCspLeftWrites += 1;
}

export function waveformScrollProfileMinimapViewportWrite(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.minimapViewportWrites += 1;
}

export function waveformScrollProfileRulerSkipped(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.rulerSkipped += 1;
  if (cspLeftWrite) counters.rulerCspLeftWrites += 1;
}

export function waveformScrollProfileRulerRepaint(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.rulerRepaint += 1;
  if (cspLeftWrite) counters.rulerCspLeftWrites += 1;
}

/** Call on scroll idle (~120ms after last tier frame) to flush one summary line. */
export function waveformScrollProfileMaybeFlushBurst(): void {
  if (!isWaveformScrollProfileEnabled() || !burstActive) return;
  const elapsedMs = performance.now() - burstStartedAt;
  if (elapsedMs < 120) return;
  burstActive = false;
  const {
    tierFrames,
    bandSkipped,
    bandRepaint,
    bandCspLeftWrites,
    rulerSkipped,
    rulerRepaint,
    rulerCspLeftWrites,
    minimapViewportWrites,
  } = counters;
  const bandSkipPct =
    tierFrames > 0 ? Math.round((bandSkipped / tierFrames) * 100) : 0;
  const rulerSkipPct =
    tierFrames > 0 ? Math.round((rulerSkipped / tierFrames) * 100) : 0;
  emitLine(
    `[scroll-profile] burst ${elapsedMs.toFixed(0)}ms · frames=${tierFrames} · band skip=${bandSkipped} (${bandSkipPct}%) repaint=${bandRepaint} cspLeft=${bandCspLeftWrites} · ruler skip=${rulerSkipped} (${rulerSkipPct}%) repaint=${rulerRepaint} cspLeft=${rulerCspLeftWrites} · minimapVp=${minimapViewportWrites}`,
  );
  counters.tierFrames = 0;
  counters.bandSkipped = 0;
  counters.bandRepaint = 0;
  counters.bandCspLeftWrites = 0;
  counters.minimapViewportWrites = 0;
  counters.rulerSkipped = 0;
  counters.rulerRepaint = 0;
  counters.rulerCspLeftWrites = 0;
}

export function installWaveformScrollProfileDevTools(): void {
  if (typeof window === "undefined") return;
  const api = {
    help: () => {
      const message = [
        "1. __rushiScrollProfile.enable()",
        "2. 打开 Editor，波形区横滚 3–5 秒",
        "3. __rushiScrollProfile.print() 或 __rushiScrollProfile.recent()",
        "band/ruler skip 高 = 脏区优化生效；ruler repaint≈frames = ruler 仍是主因",
      ].join("\n");
      // eslint-disable-next-line no-console -- dev-only
      console.info(message);
      return { message };
    },
    enable: () => {
      setWaveformScrollProfileEnabled(true);
      resetWaveformScrollProfileCounters();
      const message =
        "[scroll-profile] enabled — scroll waveform tier; burst summaries auto-log to console";
      emitLine(message);
      return {
        enabled: true,
        message,
        next: "scroll 3–5s then __rushiScrollProfile.print()",
      };
    },
    disable: () => {
      setWaveformScrollProfileEnabled(false);
      resetWaveformScrollProfileCounters();
      const message = "[scroll-profile] disabled";
      emitLine(message);
      return { enabled: false, message };
    },
    enabled: () => isWaveformScrollProfileEnabled(),
    counters: () => ({ ...counters }),
    recent: () => [...recentLines],
    print: () => {
      if (recentLines.length === 0) {
        const message =
          "[scroll-profile] (no lines yet — enable(), scroll waveform tier 3–5s, then print again)";
        // eslint-disable-next-line no-console -- dev-only
        console.info(message);
        return { lines: [] as string[], message, counters: { ...counters } };
      }
      for (const line of recentLines) {
        // eslint-disable-next-line no-console -- dev-only
        console.info(line);
      }
      return { lines: [...recentLines], counters: { ...counters } };
    },
    reset: () => {
      resetWaveformScrollProfileCounters();
      return { ok: true, counters: { ...counters } };
    },
  };
  Object.defineProperty(window, "__rushiScrollProfile", {
    value: api,
    configurable: true,
    writable: true,
  });
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

export function resetWaveformScrollProfileForTests(): void {
  enabled = false;
  resetWaveformScrollProfileCounters();
  recentLines.length = 0;
}
