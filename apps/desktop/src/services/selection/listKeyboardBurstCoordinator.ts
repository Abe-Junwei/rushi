/** Coordinates listKeyboard burst keyup reveal (SC1 deferred until P9b2). */

const KEYUP_REVEAL_FALLBACK_MS = 64;

let pendingKeyupRevealIdx: number | null = null;
let pendingKeyupRevealScrollKey: string | null = null;
let keyupRevealHandler: ((idx: number) => void) | null = null;
let keyupRevealFallbackTimer = 0;

function clearKeyupRevealFallbackTimer(): void {
  window.clearTimeout(keyupRevealFallbackTimer);
  keyupRevealFallbackTimer = 0;
}

function deliverKeyupReveal(idx: number): void {
  clearKeyupRevealFallbackTimer();
  pendingKeyupRevealIdx = null;
  pendingKeyupRevealScrollKey = null;
  keyupRevealHandler?.(idx);
}

export function registerListKeyboardKeyupRevealHandler(handler: ((idx: number) => void) | null): void {
  keyupRevealHandler = handler;
}

export function queueListKeyboardKeyupReveal(input: { idx: number; scrollKey: string }): void {
  clearKeyupRevealFallbackTimer();
  pendingKeyupRevealIdx = input.idx;
  pendingKeyupRevealScrollKey = input.scrollKey;
  keyupRevealFallbackTimer = window.setTimeout(
    () => flushListKeyboardKeyupRevealFallback(),
    KEYUP_REVEAL_FALLBACK_MS,
  );
}

export function notifyListKeyboardLayoutSettled(scrollKey: string): void {
  if (pendingKeyupRevealIdx == null || pendingKeyupRevealScrollKey !== scrollKey) return;
  deliverKeyupReveal(pendingKeyupRevealIdx);
}

export function cancelListKeyboardKeyupReveal(): void {
  clearKeyupRevealFallbackTimer();
  pendingKeyupRevealIdx = null;
  pendingKeyupRevealScrollKey = null;
}

/** Tests / fallback when layout effect does not run in time. */
export function flushListKeyboardKeyupRevealFallback(): void {
  if (pendingKeyupRevealIdx == null) return;
  deliverKeyupReveal(pendingKeyupRevealIdx);
}

export function resetListKeyboardBurstCoordinatorForTests(): void {
  keyupRevealHandler = null;
  cancelListKeyboardKeyupReveal();
}
