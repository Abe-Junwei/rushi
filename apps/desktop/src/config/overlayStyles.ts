/**
 * Modal scrim — single source for dialog/panel overlays.
 * Scrim 压暗底层；浮层壳 flat（见 shellVisualTokens FLAT_OVERLAY_PANEL_SHELL_CLASS）。
 */

import {
  FLAT_OVERLAY_PANEL_SHELL_CLASS,
  FLAT_SHELL_ELEVATION_CLASS,
  MAIN_SHELL_SURFACE_CLASS,
  OVERLAY_SCRIM_LAYER_CLASS,
  OVERLAY_SCRIM_SURFACE_CLASS,
} from "./shellVisualTokens";

export {
  FLAT_OVERLAY_PANEL_SHELL_CLASS,
  FLAT_SHELL_ELEVATION_CLASS,
  MAIN_SHELL_SURFACE_CLASS,
  OVERLAY_SCRIM_SURFACE_CLASS,
};

export const OVERLAY_SCRIM_BG = OVERLAY_SCRIM_SURFACE_CLASS.bg;

/** Full-viewport scrim without flex layout */
export const OVERLAY_SCRIM_LAYER = OVERLAY_SCRIM_LAYER_CLASS;

/** Centered modal overlay; pass Tailwind z-* class (literal, for JIT scan). */
export function overlayScrimCentered(zIndexClass: string): string {
  return `${OVERLAY_SCRIM_LAYER} ${zIndexClass} flex items-center justify-center p-6`;
}
