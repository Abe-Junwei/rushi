"""P4: lightweight evaluation metrics (character-level CER, term hit rate, low-confidence ratio)."""

from __future__ import annotations


def levenshtein_chars(a: str, b: str) -> int:
    """Unicode codepoint-level Levenshtein distance (DP, O(len(a)*len(b)))."""
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if la == 0:
        return lb
    if lb == 0:
        return la
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[lb]


def cer_chars(reference: str, hypothesis: str) -> float:
    """
    Character error rate = edit_distance(ref, hyp) / max(len(ref), 1).
    Empty reference returns 0.0 if hypothesis empty else 1.0.
    """
    ref = reference.strip()
    hyp = hypothesis.strip()
    if not ref:
        return 0.0 if not hyp else 1.0
    return levenshtein_chars(ref, hyp) / len(ref)


def term_hit_rate(terms: list[str], hypothesis: str) -> float:
    """
    Naive term recall: fraction of ``terms`` that appear as substrings in ``hypothesis``.
    Empty ``terms`` returns 1.0.
    """
    if not terms:
        return 1.0
    hyp = hypothesis
    hits = sum(1 for t in terms if t and t.strip() and t.strip() in hyp)
    return hits / len(terms)


def low_confidence_ratio(segments: list[dict]) -> float:
    """``segments`` items with bool ``low_confidence``; empty list returns 0.0."""
    if not segments:
        return 0.0
    low = sum(1 for s in segments if s.get("low_confidence"))
    return low / len(segments)
