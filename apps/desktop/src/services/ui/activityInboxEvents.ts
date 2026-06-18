export const ACTIVITY_INBOX_TOGGLE_EVENT = "rushi:activity-inbox-toggle";
export const ACTIVITY_INBOX_CLOSE_EVENT = "rushi:activity-inbox-close";

export function requestToggleActivityInbox(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTIVITY_INBOX_TOGGLE_EVENT));
}

export function requestCloseActivityInbox(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTIVITY_INBOX_CLOSE_EVENT));
}
