#!/usr/bin/env python3
"""Small reproducible RTTM diarization scorer (collar + skip-overlap, optimal mapping)."""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path


def read_rttm(path: Path) -> list[tuple[float, float, str]]:
    rows: list[tuple[float, float, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) < 8 or fields[0] != "SPEAKER":
            raise ValueError(f"invalid RTTM row: {line}")
        start = float(fields[3])
        duration = float(fields[4])
        rows.append((start, start + duration, fields[7]))
    return rows


def score(
    reference: list[tuple[float, float, str]],
    hypothesis: list[tuple[float, float, str]],
    *,
    collar: float = 0.25,
    frame: float = 0.01,
    skip_overlap: bool = True,
) -> dict[str, float | dict[str, str]]:
    end = max([row[1] for row in reference + hypothesis], default=0.0)
    boundaries = [value for start, stop, _ in reference for value in (start, stop)]
    samples: list[tuple[str | None, str | None]] = []
    for index in range(int(end / frame) + 1):
        at = (index + 0.5) * frame
        if any(abs(at - boundary) < collar for boundary in boundaries):
            continue
        refs = [speaker for start, stop, speaker in reference if start <= at < stop]
        if skip_overlap and len(set(refs)) > 1:
            continue
        ref = refs[0] if len(refs) == 1 else None
        hyps = [speaker for start, stop, speaker in hypothesis if start <= at < stop]
        hyp = hyps[0] if len(hyps) == 1 else None
        samples.append((ref, hyp))

    ref_labels = sorted({ref for ref, _ in samples if ref is not None})
    hyp_labels = sorted({hyp for _, hyp in samples if hyp is not None})
    best_mapping: dict[str, str] = {}
    best_correct = -1
    targets = ref_labels + [f"__extra_{i}" for i in range(max(0, len(hyp_labels) - len(ref_labels)))]
    for assigned in itertools.permutations(targets, len(hyp_labels)):
        mapping = dict(zip(hyp_labels, assigned, strict=True))
        correct = sum(ref is not None and mapping.get(hyp) == ref for ref, hyp in samples)
        if correct > best_correct:
            best_correct = correct
            best_mapping = mapping

    speech_frames = sum(ref is not None for ref, _ in samples)
    miss = sum(ref is not None and hyp is None for ref, hyp in samples)
    false_alarm = sum(ref is None and hyp is not None for ref, hyp in samples)
    confusion = sum(
        ref is not None and hyp is not None and best_mapping.get(hyp) != ref
        for ref, hyp in samples
    )
    denominator = max(1, speech_frames)
    coverage = sum(ref is not None and hyp is not None for ref, hyp in samples) / denominator
    return {
        "der": (miss + false_alarm + confusion) / denominator,
        "miss": miss / denominator,
        "false_alarm": false_alarm / denominator,
        "confusion": confusion / denominator,
        "speaker_coverage": coverage,
        "scored_speech_sec": speech_frames * frame,
        "mapping": best_mapping,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path)
    parser.add_argument("hypothesis", type=Path)
    parser.add_argument("--collar", type=float, default=0.25)
    parser.add_argument("--frame", type=float, default=0.01)
    parser.add_argument("--include-overlap", action="store_true")
    args = parser.parse_args()
    result = score(
        read_rttm(args.reference),
        read_rttm(args.hypothesis),
        collar=args.collar,
        frame=args.frame,
        skip_overlap=not args.include_overlap,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
