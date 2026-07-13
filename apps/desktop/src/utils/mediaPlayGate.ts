/**
 * Serialize media pause / seek / play for one playback host.
 *
 * macOS 26 WKWebView activates CoreAudio via a *synchronous* WebContent→GPU IPC
 * (`RemoteAudioSession::tryToSetActive`). Nested or back-to-back pause→play in
 * the same turn (or within a few ms) deadlocks WebContent in waitForSyncReply.
 *
 * Spec: docs/execution/specs/wkwebview-audio-session-keepalive-research.md
 *
 * Native CPAL transport does not need the WK pause→play gap; pass
 * `{ pauseToPlayGapMs: 0 }` (or use {@link runGatedMediaPlay} with native host).
 */

export type MediaOpKind = "pause" | "seek" | "play";

/** Minimum gap after a pause before the next play() on WK MediaElement hosts. */
export const MEDIA_PAUSE_TO_PLAY_GAP_MS = 80;

export type EnqueueMediaOpOptions = {
  /** Override pause→play gap. Native transport should pass 0. */
  pauseToPlayGapMs?: number;
};

type HostGate = {
  /** Serial chain of media ops for this host. */
  tail: Promise<void>;
  /** performance.now() when the last pause op finished; null if never paused. */
  lastPauseCompletedAt: number | null;
  /** Legacy in-flight play lock (tryBeginMediaPlay). */
  playInFlight: boolean;
};

const gates = new WeakMap<object, HostGate>();

function getGate(host: object): HostGate {
  let g = gates.get(host);
  if (!g) {
    g = {
      tail: Promise.resolve(),
      lastPauseCompletedAt: null,
      playInFlight: false,
    };
    gates.set(host, g);
  }
  return g;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Record that media was paused outside the queue (e.g. deferred bound-stop).
 * Ensures the next gated play waits for the configured pause→play gap.
 */
export function noteMediaPaused(host: object): void {
  getGate(host).lastPauseCompletedAt = performance.now();
}

export function isMediaPlayInFlight(host: object): boolean {
  return getGate(host).playInFlight;
}

/** Acquire the play gate. Caller must `endMediaPlay` in `finally`. */
export function tryBeginMediaPlay(host: object): boolean {
  const g = getGate(host);
  if (g.playInFlight) return false;
  g.playInFlight = true;
  return true;
}

export function endMediaPlay(host: object): void {
  getGate(host).playInFlight = false;
}

/**
 * Enqueue a media op. Ops on the same host never overlap. Play waits until
 * the configured pause→play gap after the last pause on that host.
 */
export function enqueueMediaOp(
  host: object,
  kind: MediaOpKind,
  op: () => void | Promise<void>,
  options?: EnqueueMediaOpOptions,
): Promise<void> {
  const g = getGate(host);
  const gapMs = options?.pauseToPlayGapMs ?? MEDIA_PAUSE_TO_PLAY_GAP_MS;
  const run = async () => {
    if (kind === "play" && g.lastPauseCompletedAt != null && gapMs > 0) {
      const elapsed = performance.now() - g.lastPauseCompletedAt;
      const wait = Math.max(0, gapMs - elapsed);
      if (wait > 0) await delay(wait);
    }
    try {
      await op();
    } finally {
      if (kind === "pause") {
        g.lastPauseCompletedAt = performance.now();
      }
    }
  };
  const next = g.tail.then(run, run);
  // Keep the chain alive even if `next` rejects.
  g.tail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Run `play` under the serial queue (+ pause→play gap). */
export async function runGatedMediaPlay(
  host: object,
  play: () => void | Promise<void>,
  options?: EnqueueMediaOpOptions,
): Promise<"ok" | "busy"> {
  if (!tryBeginMediaPlay(host)) return "busy";
  try {
    await enqueueMediaOp(host, "play", play, options);
    return "ok";
  } finally {
    endMediaPlay(host);
  }
}

/** Run `pause` under the serial queue and stamp pause time. */
export async function runGatedMediaPause(
  host: object,
  pause: () => void | Promise<void>,
  options?: EnqueueMediaOpOptions,
): Promise<"ok"> {
  await enqueueMediaOp(host, "pause", pause, options);
  return "ok";
}

/** Run seek / setTime under the serial queue (no pause→play gap). */
export async function runGatedMediaSeek(
  host: object,
  seek: () => void | Promise<void>,
  options?: EnqueueMediaOpOptions,
): Promise<"ok"> {
  await enqueueMediaOp(host, "seek", seek, options);
  return "ok";
}

/** Test helper: clear pause timestamp so the next play does not wait. */
export function resetMediaPauseClockForTests(host: object): void {
  getGate(host).lastPauseCompletedAt = null;
}
