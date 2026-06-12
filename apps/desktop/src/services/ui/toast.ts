import { humanizeInvokeError } from "./humanizeInvokeError";

export type ToastVariant = "info" | "warning" | "error" | "success";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  exiting?: boolean;
  actionLabel?: string;
};

const toastActionHandlers = new Map<string, () => void>();

const DEDUP_MS = 2500;
const FADE_OUT_MS = 260;

const EMPTY_SNAPSHOT: readonly ToastItem[] = [];

const listeners = new Set<() => void>();
let current: ToastItem | null = null;
/** Stable array ref for useSyncExternalStore (React 19 requires cached getSnapshot). */
let snapshot: readonly ToastItem[] = EMPTY_SNAPSHOT;
let seq = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;
let lastDedup: { message: string; variant: ToastVariant; at: number } | null = null;

function defaultDurationMs(variant: ToastVariant): number {
  switch (variant) {
    case "error":
      return 8_000;
    case "warning":
      return 6_000;
    case "success":
      return 6_000;
    default:
      return 6_000;
  }
}

function syncSnapshot() {
  if (!current) {
    snapshot = EMPTY_SNAPSHOT;
    return;
  }
  if (snapshot.length === 1 && snapshot[0] === current) return;
  snapshot = [current];
}

function emit() {
  syncSnapshot();
  for (const fn of listeners) fn();
}

function clearTimers() {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (removeTimer !== null) {
    clearTimeout(removeTimer);
    removeTimer = null;
  }
}

function removeNow() {
  if (current?.id) toastActionHandlers.delete(current.id);
  current = null;
  emit();
}

/** Runs optional toast action without dismissing the pill. */
export function runToastAction(id: string): void {
  toastActionHandlers.get(id)?.();
}

function beginDismiss() {
  if (!current) return;
  clearTimers();
  current = { ...current, exiting: true };
  emit();
  removeTimer = setTimeout(() => {
    removeNow();
    removeTimer = null;
  }, FADE_OUT_MS);
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): readonly ToastItem[] {
  return snapshot;
}

/** Prefer in React subscribers — same cached reference as getToasts(). */
export function getToastSnapshot(): readonly ToastItem[] {
  return snapshot;
}

/** Immediate clear (tests / programmatic). */
export function dismissToast(id?: string): void {
  if (id !== undefined && current?.id !== id) return;
  clearTimers();
  if (current?.id) toastActionHandlers.delete(current.id);
  current = null;
  lastDedup = null;
  emit();
}

export function showToast(input: {
  variant: ToastVariant;
  message: string;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}): string {
  const message = input.message.trim();
  if (!message) return "";

  const variant = input.variant;
  const now = Date.now();
  const prev = lastDedup;
  if (
    prev &&
    prev.message === message &&
    prev.variant === variant &&
    now - prev.at < DEDUP_MS
  ) {
    return current?.id ?? "";
  }
  lastDedup = { message, variant, at: now };

  clearTimers();
  if (current?.id) toastActionHandlers.delete(current.id);
  const id = String(++seq);
  const durationMs = input.durationMs ?? defaultDurationMs(variant);
  const actionLabel = input.action?.label.trim();
  if (input.action?.onClick) {
    toastActionHandlers.set(id, input.action.onClick);
  }
  current = {
    id,
    variant,
    message,
    durationMs,
    exiting: false,
    ...(actionLabel ? { actionLabel } : {}),
  };
  emit();

  if (durationMs > 0 && durationMs < Number.POSITIVE_INFINITY) {
    const delay = Math.max(durationMs - FADE_OUT_MS, 0);
    dismissTimer = setTimeout(beginDismiss, delay);
  }
  return id;
}

export const toast = {
  info: (message: string, durationMs?: number) =>
    showToast({ variant: "info", message, durationMs }),
  success: (message: string) => showToast({ variant: "success", message }),
  warning: (message: string, durationMs?: number) =>
    showToast({ variant: "warning", message, durationMs }),
  error: (message: string) => showToast({ variant: "error", message }),
  errorFromUnknown: (raw: unknown) => showToast({ variant: "error", message: humanizeInvokeError(raw) }),
  dismiss: dismissToast,
};

/** Post-transcribe hints: merged into one pill (replaces prior toast). */
export function pushTranscribeHintsToToast(hints: string[]): void {
  const lines = hints.map((h) => h.trim()).filter(Boolean);
  if (lines.length === 0) return;
  const message = lines.join(" · ");
  const isError = lines.some((line) => line.includes("失败") || line.includes("错误"));
  if (isError) toast.error(message);
  else toast.warning(message);
}

/** Transcribe done: summary only (用时 / 语段数 / 字符数). Optional action (A-2 定稿模式). */
export function pushTranscribeResultToast(
  summary: string,
  action?: { label: string; onClick: () => void },
): void {
  const message = summary.trim();
  if (!message) return;
  const actionLabel = action?.label.trim();
  showToast({
    variant: "success",
    message,
    durationMs: 6_000,
    ...(action?.onClick && actionLabel
      ? { action: { label: actionLabel, onClick: action.onClick } }
      : {}),
  });
}
