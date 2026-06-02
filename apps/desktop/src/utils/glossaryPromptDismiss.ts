const KEY = "rushi:glossary-learn-prompt-dismissed:v1";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function isGlossaryPromptDismissed(afterText: string): boolean {
  return readSet().has(afterText.trim());
}

export function dismissGlossaryPrompt(afterText: string): void {
  const set = readSet();
  set.add(afterText.trim());
  writeSet(set);
}

export function filterUndismissedPrompts<T extends { afterText: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isGlossaryPromptDismissed(r.afterText));
}
