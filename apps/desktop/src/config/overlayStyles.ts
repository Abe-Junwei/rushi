/**
 * Modal scrim — single source for dialog/panel overlays.
 * No backdrop-blur (see docs/architecture/desktop-tailwind-v4.md).
 */

/** Background utility only — pair with fixed/inset/z-* */
export const OVERLAY_SCRIM_BG = "bg-zen-ink/10";

/** Full-viewport scrim without flex layout */
export const OVERLAY_SCRIM_LAYER = `fixed inset-0 ${OVERLAY_SCRIM_BG}`;

/** Centered modal overlay; pass Tailwind z-* class (literal, for JIT scan). */
export function overlayScrimCentered(zIndexClass: string): string {
  return `${OVERLAY_SCRIM_LAYER} ${zIndexClass} flex items-center justify-center p-6`;
}
