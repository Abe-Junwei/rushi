"""P4: lightweight evaluation metrics (character-level CER, term hit rate, low-confidence ratio)."""

from __future__ import annotations

import re
import unicodedata


def normalize_cer_text(text: str) -> str:
    """Strip all whitespace for Chinese char-level CER (ref from docx, hyp from segment concat)."""
    return re.sub(r"\s+", "", text.strip())


def normalize_cer_content_text(text: str) -> str:
    """Strip whitespace and Unicode punctuation to score ASR content separately."""
    compact = normalize_cer_text(text)
    return "".join(ch for ch in compact if not unicodedata.category(ch).startswith("P"))


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
    ref = normalize_cer_text(reference)
    hyp = normalize_cer_text(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return levenshtein_chars(ref, hyp) / len(ref)


def content_cer_chars(reference: str, hypothesis: str) -> float:
    """Character error rate after removing whitespace and Unicode punctuation."""
    ref = normalize_cer_content_text(reference)
    hyp = normalize_cer_content_text(hypothesis)
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


def rtfx(duration_sec: float | None, wall_sec: float | None) -> float | None:
    """
    Inverse real-time factor: audio duration / wall-clock transcribe time.

    Matches ASR Leaderboard RTFx (audio_seconds / inference_seconds). Returns ``None``
    when inputs are missing or non-positive.
    """
    if duration_sec is None or wall_sec is None:
        return None
    try:
        d = float(duration_sec)
        w = float(wall_sec)
    except (TypeError, ValueError):
        return None
    if d <= 0 or w <= 0 or d != d or w != w:  # NaN
        return None
    return d / w


def resolve_segmentation_mode(
    body: dict[str, object],
    warnings: list[object] | None,
) -> str | None:
    """Prefer response ``segmentation_mode``; else parse ``segmentation_mode:`` warnings."""
    raw = body.get("segmentation_mode")
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    for w in warnings or []:
        if isinstance(w, str) and w.startswith("segmentation_mode:"):
            tail = w.split(":", 1)[1].strip()
            if tail:
                return tail
    return None
