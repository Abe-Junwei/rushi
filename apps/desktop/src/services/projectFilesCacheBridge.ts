/** Welcome「所有文件」嵌套文件列表缓存 — invalidator 由 WelcomeView 注册。 */

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
