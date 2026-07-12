/**
 * Prevent nested / concurrent HTMLMediaElement.play() which can deadlock
 * WebKit (MediaSession sync IPC re-entrancy on the WebContent main thread).
 */

const playInFlight = new WeakMap<object, true>();

export function isMediaPlayInFlight(host: object): boolean {
  return playInFlight.has(host);
}

/** Acquire the play gate. Caller must `endMediaPlay` in `finally`. */
export function tryBeginMediaPlay(host: object): boolean {
  if (playInFlight.has(host)) return false;
  playInFlight.set(host, true);
  return true;
}

export function endMediaPlay(host: object): void {
  playInFlight.delete(host);
}

/** Run `play` under the gate. Returns `"busy"` if another play holds the lock. */
export async function runGatedMediaPlay(
  host: object,
  play: () => void | Promise<void>,
): Promise<"ok" | "busy"> {
  if (!tryBeginMediaPlay(host)) return "busy";
  try {
    await play();
    return "ok";
  } finally {
    endMediaPlay(host);
  }
}
