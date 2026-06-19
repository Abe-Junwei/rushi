import type { FloatingPanelPersistedState } from "./floatingPanelViewport";

/** Bump 时丢弃所有旧 persist 尺寸/位置。4 = CSS 自动高度单一真源（FLOAT-FIT）。 */
export const FLOATING_PANEL_LAYOUT_REV = 4;

type FloatingPanelPhasePersist = {
  size: { width: number; height: number };
  userSized?: boolean;
};

export type FloatingPanelPersistedStateV2 = FloatingPanelPersistedState & {
  userSized?: boolean;
  layoutRev?: number;
  phases?: Record<string, FloatingPanelPhasePersist>;
};

export function loadFloatingPanelPersistedState(
  storageKey: string,
): FloatingPanelPersistedStateV2 | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FloatingPanelPersistedStateV2;
    if (parsed.position && parsed.size) return parsed;
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveFloatingPanelPersistedState(
  storageKey: string,
  state: FloatingPanelPersistedStateV2,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function resolvePhasePersistedSize(
  saved: FloatingPanelPersistedStateV2 | null,
  phaseKey: string | undefined,
  layoutRev: number,
): { size: FloatingPanelPersistedStateV2["size"]; userSized: boolean } | null {
  if (!saved) return null;
  if (saved.layoutRev !== layoutRev) return null;

  if (phaseKey && saved.phases?.[phaseKey]) {
    const phase = saved.phases[phaseKey];
    return { size: phase.size, userSized: phase.userSized === true };
  }

  // 有 phaseKey 但无对应条目时不用全局 size，避免 preview 高度污染 loading/consent。
  if (phaseKey) return null;

  return { size: saved.size, userSized: saved.userSized === true };
}

export function mergePhaseIntoPersistedState(args: {
  prev: FloatingPanelPersistedStateV2 | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  viewport?: { width: number; height: number };
  userSized: boolean;
  phaseKey?: string;
  layoutRev: number;
}): FloatingPanelPersistedStateV2 {
  const base: FloatingPanelPersistedStateV2 = {
    position: args.position,
    size: args.size,
    viewport: args.viewport,
    userSized: args.userSized,
    layoutRev: args.layoutRev,
    phases: args.prev?.phases ? { ...args.prev.phases } : undefined,
  };

  if (args.phaseKey) {
    const phases = { ...(base.phases ?? {}) };
    phases[args.phaseKey] = { size: args.size, userSized: args.userSized };
    base.phases = phases;
  }

  return base;
}
