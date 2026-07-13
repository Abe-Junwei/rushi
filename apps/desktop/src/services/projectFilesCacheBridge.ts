/** Sidebar nested file list cache — mutations live above WelcomeSidebar. */

type Invalidator = (projectIds: string[]) => void;

let invalidator: Invalidator | null = null;

export function registerProjectFilesCacheInvalidator(fn: Invalidator | null): void {
  invalidator = fn;
}

export function invalidateProjectFilesCaches(projectIds: string[]): void {
  try {
    invalidator?.(projectIds);
  } catch {
    // Sidebar may be unmounted.
  }
}
