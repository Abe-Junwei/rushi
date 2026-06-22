/** Coordinates imperative list scroll during listKeyboard burst (SC1 deferred). */

const KEYUP_REVEAL_FALLBACK_MS = 64;

let scrollEpochNotifier: ((options?: { force?: boolean; sync?: boolean }) => void) | null = null;
let lastImperativeScrollKey: string | null = null;
let pinnedVirtualDisplayIndex: number | null = null;
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

export function registerListKeyboardScrollEpochNotifier(
  notifier: ((options?: { force?: boolean; sync?: boolean }) => void) | null,
): void {
  scrollEpochNotifier = notifier;
}

export function notifyListKeyboardScrollEpoch(options?: { force?: boolean; sync?: boolean }): void {
  scrollEpochNotifier?.(options);
}

export function markListKeyboardImperativeScrollKey(scrollKey: string): void {
  lastImperativeScrollKey = scrollKey;
}

export function shouldSkipLayoutScrollForListKeyboard(scrollKey: string): boolean {
  return lastImperativeScrollKey === scrollKey;
}

export function clearListKeyboardImperativeScrollKey(): void {
  lastImperativeScrollKey = null;
}

export function pinListKeyboardVirtualDisplayIndex(index: number): void {
  pinnedVirtualDisplayIndex = index;
}

export function readListKeyboardVirtualDisplayPin(): number | null {
  return pinnedVirtualDisplayIndex;
}

export function clearListKeyboardVirtualDisplayPin(): void {
  pinnedVirtualDisplayIndex = null;
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

/** File switch / teardown: drop pin + layout skip key; keep scroll epoch notifier. */
export function resetListKeyboardBurstScrollState(): void {
  lastImperativeScrollKey = null;
  pinnedVirtualDisplayIndex = null;
  cancelListKeyboardKeyupReveal();
}

export function resetListKeyboardBurstCoordinatorForTests(): void {
  scrollEpochNotifier = null;
  lastImperativeScrollKey = null;
  pinnedVirtualDisplayIndex = null;
  keyupRevealHandler = null;
  cancelListKeyboardKeyupReveal();
}
