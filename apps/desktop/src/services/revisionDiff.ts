import { splitGraphemes } from "./text/grapheme";

export type RevisionSpan =
  | { kind: "equal"; text: string }
  | { kind: "delete"; text: string }
  | { kind: "insert"; text: string };

export type RevisionChangeItem = { removed: string; inserted: string };

/** 将 diff 片段拆成用户可读的逐条改词（仅预览，不用于推断学词对）。 */
export function listRevisionChanges(baseline: string, live: string): RevisionChangeItem[] {
  const spans = computeRevisionSpans(baseline, live);
  const items: RevisionChangeItem[] = [];
  let i = 0;
  while (i < spans.length) {
    if (spans[i]!.kind !== "delete" && spans[i]!.kind !== "insert") {
      i += 1;
      continue;
    }
    let removed = "";
    while (i < spans.length && spans[i]!.kind === "delete") {
      removed += spans[i]!.text;
      i += 1;
    }
    let inserted = "";
    while (i < spans.length && spans[i]!.kind === "insert") {
      inserted += spans[i]!.text;
      i += 1;
    }
    if (removed.length > 0 || inserted.length > 0) {
      items.push({ removed, inserted });
    }
  }
  return items;
}

/** 最小编辑距离 diff；回溯时优先「替换」(删+插) 而非吞掉中间未改字。 */
export function computeRevisionSpans(baseline: string, live: string): RevisionSpan[] {
  if (baseline === live) {
    return baseline ? [{ kind: "equal", text: baseline }] : [];
  }
  const a = splitGraphemes(baseline);
  const b = splitGraphemes(live);
  const n = a.length;
  const m = b.length;
  if (n === 0) {
    return live ? [{ kind: "insert", text: live }] : [];
  }
  if (m === 0) {
    return [{ kind: "delete", text: baseline }];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j - 1]! + cost,
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
      );
    }
  }

  const raw: Array<{ kind: RevisionSpan["kind"]; char: string }> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ kind: "equal", char: a[i - 1]! });
      i -= 1;
      j -= 1;
      continue;
    }
    if (i > 0 && j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      raw.push({ kind: "delete", char: a[i - 1]! });
      raw.push({ kind: "insert", char: b[j - 1]! });
      i -= 1;
      j -= 1;
      continue;
    }
    if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      raw.push({ kind: "delete", char: a[i - 1]! });
      i -= 1;
      continue;
    }
    raw.push({ kind: "insert", char: b[j - 1]! });
    j -= 1;
  }
  raw.reverse();

  const spans: RevisionSpan[] = [];
  for (const op of raw) {
    const last = spans[spans.length - 1];
    if (last && last.kind === op.kind) last.text += op.char;
    else spans.push({ kind: op.kind, text: op.char });
  }
  return foldOrphanDeleteBeforeEqual(spans, baseline);
}

/**
 * 替换后若 baseline 仍含「删一字 + 后文」而 live 只保留后文（如 千年→天 后 年前），
 * 勿把 baseline 的上下文拆成 delete+equal，避免 年 误显示为删除。
 */
function foldOrphanDeleteBeforeEqual(spans: RevisionSpan[], baseline: string): RevisionSpan[] {
  const out: RevisionSpan[] = [];
  let i = 0;
  while (i < spans.length) {
    const a = spans[i];
    const b = spans[i + 1];
    const c = spans[i + 2];
    const d = spans[i + 3];
    if (
      a?.kind === "delete" &&
      b?.kind === "insert" &&
      c?.kind === "delete" &&
      c.text.length === 1 &&
      d?.kind === "equal" &&
      baseline.includes(c.text + d.text)
    ) {
      out.push(a, b, { kind: "equal", text: c.text + d.text });
      i += 4;
      continue;
    }
    out.push(spans[i]!);
    i += 1;
  }
  return out;
}
