import type { ToastVariant } from "./toast";

export type ActivityFeedVariant = Exclude<ToastVariant, "info">;

export type ActivityFeedKind = "generic" | "batch_transcribe" | "transcribe" | "export" | "edit_history";

export type ActivityFeedActionKind = "open-file" | "open-project-hub" | "delivery-mode";

export type ActivityFeedItem = {
  id: string;
  variant: ActivityFeedVariant;
  message: string;
  at: number;
  read: boolean;
  kind?: ActivityFeedKind;
  projectId?: string;
  fileId?: string;
  fileLabel?: string;
  actionLabel?: string;
  actionKind?: ActivityFeedActionKind;
};

const STORAGE_KEY = "rushi.activity-feed.v1";
const MAX_ITEMS = 20;
export const ACTIVITY_FEED_MAX_ITEMS = MAX_ITEMS;
export const ACTIVITY_FEED_CHANGED_EVENT = "rushi:activity-feed-changed";

const actionHandlers = new Map<string, () => void>();
const listeners = new Set<() => void>();

let items: ActivityFeedItem[] = [];
let seq = 0;

function emit(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVITY_FEED_CHANGED_EVENT));
  }
  for (const fn of listeners) fn();
}

function persist(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload = items.map(
      ({ id, variant, message, at, read, kind, projectId, fileId, fileLabel, actionLabel, actionKind }) => ({
        id,
        variant,
        message,
        at,
        read,
        ...(kind && kind !== "generic" ? { kind } : {}),
        ...(projectId ? { projectId } : {}),
        ...(fileId ? { fileId } : {}),
        ...(fileLabel ? { fileLabel } : {}),
        ...(actionLabel ? { actionLabel } : {}),
        ...(actionKind ? { actionKind } : {}),
      }),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

function loadFromStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ActivityFeedItem[];
    if (!Array.isArray(parsed)) return;
    items = parsed
      .filter(
        (row) =>
          row &&
          typeof row.id === "string" &&
          typeof row.message === "string" &&
          typeof row.at === "number" &&
          (row.variant === "success" || row.variant === "warning" || row.variant === "error"),
      )
      .slice(0, MAX_ITEMS)
      .map((row) => ({
        id: row.id,
        variant: row.variant,
        message: row.message,
        at: row.at,
        read: Boolean(row.read),
        ...(row.kind === "batch_transcribe" ||
        row.kind === "transcribe" ||
        row.kind === "export" ||
        row.kind === "edit_history" ||
        row.kind === "generic"
          ? { kind: row.kind }
          : {}),
        ...(row.projectId ? { projectId: row.projectId } : {}),
        ...(row.fileId ? { fileId: row.fileId } : {}),
        ...(row.fileLabel ? { fileLabel: row.fileLabel } : {}),
        ...(row.actionLabel ? { actionLabel: row.actionLabel } : {}),
        ...(row.actionKind === "open-file" ||
        row.actionKind === "open-project-hub" ||
        row.actionKind === "delivery-mode"
          ? { actionKind: row.actionKind }
          : {}),
      }));
    const maxId = items.reduce((max, row) => {
      const n = Number.parseInt(row.id, 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    seq = maxId;
  } catch {
    items = [];
  }
}

loadFromStorage();

export function subscribeActivityFeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActivityFeedSnapshot(): readonly ActivityFeedItem[] {
  return items;
}

export function getActivityFeedUnreadCount(): number {
  return items.filter((item) => !item.read).length;
}

function activityFeedDedupeKey(item: {
  kind?: ActivityFeedKind;
  variant: ActivityFeedVariant;
  message: string;
  projectId?: string;
  fileId?: string;
}): string {
  if (item.kind && item.kind !== "generic") {
    return `${item.kind}:${item.projectId ?? ""}:${item.fileId ?? ""}:${item.message}`;
  }
  return `${item.variant}:${item.message}`;
}

export function pushActivityFeedItem(input: {
  variant: ActivityFeedVariant;
  message: string;
  at?: number;
  kind?: ActivityFeedKind;
  projectId?: string;
  fileId?: string;
  fileLabel?: string;
  actionKind?: ActivityFeedActionKind;
  action?: { label: string; onClick?: () => void };
}): string {
  const message = input.message.trim();
  if (!message) return "";

  const id = String(++seq);
  const actionLabel = input.action?.label.trim();
  if (input.action?.onClick) {
    actionHandlers.set(id, input.action.onClick);
  }

  const next: ActivityFeedItem = {
    id,
    variant: input.variant,
    message,
    at: input.at ?? Date.now(),
    read: false,
    kind: input.kind ?? "generic",
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.fileId ? { fileId: input.fileId } : {}),
    ...(input.fileLabel ? { fileLabel: input.fileLabel } : {}),
    ...(actionLabel ? { actionLabel } : {}),
    ...(input.actionKind ? { actionKind: input.actionKind } : {}),
  };

  const kept: ActivityFeedItem[] = [];
  for (const row of items) {
    if (activityFeedDedupeKey(row) === activityFeedDedupeKey(next)) {
      actionHandlers.delete(row.id);
      continue;
    }
    kept.push(row);
  }
  const merged = [next, ...kept];
  const dropped = merged.slice(MAX_ITEMS);
  items = merged.slice(0, MAX_ITEMS);
  for (const row of dropped) {
    actionHandlers.delete(row.id);
  }
  persist();
  emit();
  return id;
}

export function runActivityFeedAction(id: string): void {
  actionHandlers.get(id)?.();
}

export function markActivityFeedRead(): void {
  if (items.every((item) => item.read)) return;
  items = items.map((item) => ({ ...item, read: true }));
  persist();
  emit();
}

export function clearActivityFeedHistory(): void {
  if (items.length === 0) return;
  items = [];
  actionHandlers.clear();
  persist();
  emit();
}

/** Test helper */
export function clearActivityFeedForTests(): void {
  items = [];
  seq = 0;
  actionHandlers.clear();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore jsdom/localStorage quirks in tests */
  }
  emit();
}
