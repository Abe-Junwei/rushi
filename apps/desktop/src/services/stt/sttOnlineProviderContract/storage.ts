export function readStorage(key: string): string | null {
  try {
    if (!("localStorage" in globalThis) || !globalThis.localStorage) return null;
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null | undefined): void {
  try {
    if (!("localStorage" in globalThis) || !globalThis.localStorage) return;
    if (value == null || value === "") globalThis.localStorage.removeItem(key);
    else globalThis.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
