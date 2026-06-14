/** Split pasted glossary input (Excel TSV grid, CSV, plain lines). */

function normalizeSpreadsheetClipboard(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");
}

function normalizeGlossaryCell(raw: string): string | null {
  let t = raw.trim();
  if (!t) return null;
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    t = t.slice(1, -1).trim();
  }
  return t || null;
}

function containsListDelimiter(s: string): boolean {
  return /[,，;；、]/.test(s);
}

function splitListDelimiters(s: string): string[] {
  return s.split(/[\n\r\t,，;；、]+/);
}

function pushUnique(out: string[], seen: Set<string>, term: string | null): void {
  if (!term) return;
  const key = term.toLocaleLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(term);
}

/** Flatten Excel copy (tab between columns, newline between rows) into terms. */
export function splitGlossaryPasteInput(raw: string): string[] {
  const normalized = normalizeSpreadsheetClipboard(raw);
  if (!normalized.trim()) return [];

  const hasTab = normalized.includes("\t");
  const hasNewline = normalized.includes("\n");
  const seen = new Set<string>();
  const out: string[] = [];

  if (!hasTab && !hasNewline && containsListDelimiter(normalized)) {
    for (const piece of splitListDelimiters(normalized)) {
      pushUnique(out, seen, normalizeGlossaryCell(piece));
    }
    return out;
  }

  for (const row of normalized.split("\n")) {
    const trimmedRow = row.trim();
    if (!trimmedRow) continue;
    if (hasTab) {
      for (const cell of trimmedRow.split("\t")) {
        pushUnique(out, seen, normalizeGlossaryCell(cell));
      }
    } else {
      pushUnique(out, seen, normalizeGlossaryCell(trimmedRow));
    }
  }
  return out;
}
