import type { SegmentOverlapPolicy } from "./segmentTimeRange";

export type SegmentOverlayPointerModifiers = {
  altKey: boolean;
  shiftKey: boolean;
  toggleKey: boolean;
};

export function readSegmentOverlayModifiers(ev: {
  altKey: boolean;
  shiftKey: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): SegmentOverlayPointerModifiers {
  return {
    altKey: ev.altKey,
    shiftKey: ev.shiftKey,
    toggleKey: Boolean(ev.metaKey || ev.ctrlKey),
  };
}

/** Alt held → disable boundary snap for fine placement. */
export function isSegmentSnapEnabled(modifiers: SegmentOverlayPointerModifiers): boolean {
  return !modifiers.altKey;
}

/** Shift + box-create → allow overlapping segments; Alt+Shift → reject (no trim). */
export function resolveCreateOverlapPolicy(
  modifiers: SegmentOverlayPointerModifiers,
): SegmentOverlapPolicy {
  if (modifiers.altKey && modifiers.shiftKey) return "reject";
  if (modifiers.shiftKey) return "allow";
  return "trim";
}
