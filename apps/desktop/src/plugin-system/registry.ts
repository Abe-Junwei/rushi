/**
 * Extension point registry.
 *
 * Holds all active contributions keyed by extension-point id.
 * Thread-safe within the single JS event-loop (no cross-thread concerns).
 */

import type {
  ExtensionContributionUnion,
  ExtensionHandle,
  ExtensionPointId,
} from "./types";

const store = new Map<ExtensionPointId, Map<ExtensionHandle, ExtensionContributionUnion>>();

function ensureSlot(point: ExtensionPointId): Map<ExtensionHandle, ExtensionContributionUnion> {
  if (!store.has(point)) {
    store.set(point, new Map());
  }
  return store.get(point)!;
}

/** Register a contribution and return an opaque handle. */
export function registryRegister(
  point: ExtensionPointId,
  contribution: ExtensionContributionUnion,
): ExtensionHandle {
  const handle = `${point}::${contribution.id}::${Math.random().toString(36).slice(2, 10)}`;
  ensureSlot(point).set(handle, contribution);
  return handle;
}

/** Remove a contribution by handle. */
export function registryUnregister(handle: ExtensionHandle): void {
  for (const [, slot] of store) {
    if (slot.has(handle)) {
      slot.delete(handle);
      return;
    }
  }
}

/** Query all contributions for a given extension point. */
export function registryQuery<T extends ExtensionContributionUnion>(
  point: ExtensionPointId,
): T[] {
  const slot = store.get(point);
  if (!slot) return [];
  return Array.from(slot.values()) as T[];
}

/** Query a single contribution by its public id. */
export function registryFind<T extends ExtensionContributionUnion>(
  point: ExtensionPointId,
  id: string,
): T | undefined {
  const slot = store.get(point);
  if (!slot) return undefined;
  for (const [, c] of slot) {
    if (c.id === id) return c as T;
  }
  return undefined;
}

/** Clear everything (mainly for tests). */
export function registryClear(): void {
  store.clear();
}
