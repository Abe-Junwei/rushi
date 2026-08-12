"""Run-scoped speaker ids and cross-window CAM++ center clustering."""

from __future__ import annotations

import math
import os
import uuid
from dataclasses import dataclass
from typing import Any

from rushi_asr.schemas import DiarizationInfo, TranscriptionSegment

DEFAULT_SIMILARITY_THRESHOLD = 0.72


def normalize_local_speaker_id(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    text = str(value).strip()
    return text or None


def speaker_centers_from_result(result: dict[str, Any]) -> dict[str, list[float]]:
    """Normalize FunASR ``spk_embedding_center`` to local-spk keyed vectors."""
    raw = result.get("spk_embedding_center")
    if raw is None:
        return {}
    if hasattr(raw, "detach"):
        raw = raw.detach().cpu()
    if hasattr(raw, "tolist"):
        raw = raw.tolist()
    if isinstance(raw, dict):
        out: dict[str, list[float]] = {}
        for key, value in raw.items():
            vector = _finite_vector(value)
            local = normalize_local_speaker_id(key)
            if local is not None and vector:
                out[local] = vector
        return out
    if isinstance(raw, (list, tuple)):
        out = {}
        for idx, value in enumerate(raw):
            vector = _finite_vector(value)
            if vector:
                out[str(idx)] = vector
        return out
    return {}


def _finite_vector(value: Any) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)):
        return []
    out: list[float] = []
    for item in value:
        try:
            number = float(item)
        except (TypeError, ValueError):
            return []
        if not math.isfinite(number):
            return []
        out.append(number)
    return _l2_normalize(out)


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm <= 1e-12:
        return []
    return [x / norm for x in vector]


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return -1.0
    return sum(a * b for a, b in zip(left, right, strict=True))


@dataclass(frozen=True)
class SpeakerWindowResult:
    window_index: int
    segments: list[TranscriptionSegment]
    centers: dict[str, list[float]]


@dataclass
class _Observation:
    window_index: int
    local_id: str
    center: list[float]
    duration: float
    first_seen: float


@dataclass
class _Cluster:
    observations: list[_Observation]
    center: list[float]
    weight: float
    windows: set[int]
    first_seen: float


def _observations(windows: list[SpeakerWindowResult]) -> tuple[list[_Observation], list[str]]:
    observations: list[_Observation] = []
    warnings: list[str] = []
    for window in windows:
        stats: dict[str, tuple[float, float]] = {}
        for segment in window.segments:
            local = normalize_local_speaker_id(segment.speaker_id)
            if local is None:
                continue
            duration = max(0.0, segment.end_sec - segment.start_sec)
            current_duration, first_seen = stats.get(local, (0.0, segment.start_sec))
            stats[local] = (current_duration + duration, min(first_seen, segment.start_sec))
        for local, (duration, first_seen) in stats.items():
            center = window.centers.get(local)
            if center is None and local.startswith("spk"):
                center = window.centers.get(local[3:])
            if center is None:
                warnings.append(f"speaker_center_missing:window={window.window_index}:spk={local}")
                continue
            observations.append(
                _Observation(
                    window_index=window.window_index,
                    local_id=local,
                    center=center,
                    duration=max(duration, 1e-3),
                    first_seen=first_seen,
                )
            )
    return observations, warnings


def _merged_cluster(left: _Cluster, right: _Cluster) -> _Cluster:
    total = left.weight + right.weight
    center = _l2_normalize(
        [
            (a * left.weight + b * right.weight) / total
            for a, b in zip(left.center, right.center, strict=True)
        ]
    )
    return _Cluster(
        observations=left.observations + right.observations,
        center=center,
        weight=total,
        windows=left.windows | right.windows,
        first_seen=min(left.first_seen, right.first_seen),
    )


def _cluster_observations(
    observations: list[_Observation],
    threshold: float,
) -> list[_Cluster]:
    clusters = [
        _Cluster([obs], obs.center, obs.duration, {obs.window_index}, obs.first_seen)
        for obs in observations
    ]
    while True:
        best: tuple[float, int, int] | None = None
        for i, left in enumerate(clusters):
            for j in range(i + 1, len(clusters)):
                right = clusters[j]
                # Two speakers that co-occurred in one local diarization call are
                # a hard cannot-link, even when their centers are unusually close.
                if left.windows & right.windows:
                    continue
                similarity = _cosine(left.center, right.center)
                if similarity < threshold:
                    continue
                if best is None or similarity > best[0]:
                    best = (similarity, i, j)
        if best is None:
            break
        _, i, j = best
        merged = _merged_cluster(clusters[i], clusters[j])
        clusters = [c for idx, c in enumerate(clusters) if idx not in (i, j)]
        clusters.append(merged)
    return sorted(clusters, key=lambda cluster: cluster.first_seen)


def _run_id() -> str:
    return uuid.uuid4().hex


def finalize_speaker_windows(
    windows: list[SpeakerWindowResult],
    *,
    threshold: float | None = None,
    run_id: str | None = None,
) -> tuple[list[TranscriptionSegment], DiarizationInfo]:
    """Map window-local speaker labels to opaque, run-scoped final ids."""
    if not windows:
        return [], DiarizationInfo(status="final", run_id=run_id or _run_id(), speaker_count=0)

    effective_threshold = threshold
    if effective_threshold is None:
        try:
            effective_threshold = float(
                os.environ.get("RUSHI_FUNASR_SPK_SIMILARITY_THRESHOLD", DEFAULT_SIMILARITY_THRESHOLD)
            )
        except ValueError:
            effective_threshold = DEFAULT_SIMILARITY_THRESHOLD
    effective_threshold = max(-1.0, min(1.0, effective_threshold))
    effective_run_id = run_id or _run_id()

    observations, warnings = _observations(windows)
    mapping: dict[tuple[int, str], str] = {}

    if len(windows) == 1 and not observations:
        # A single FunASR call already has recording-scoped labels; centers are
        # only required for cross-window reconciliation.
        locals_by_first: dict[str, float] = {}
        for segment in windows[0].segments:
            local = normalize_local_speaker_id(segment.speaker_id)
            if local is not None:
                locals_by_first[local] = min(locals_by_first.get(local, segment.start_sec), segment.start_sec)
        for ordinal, local in enumerate(sorted(locals_by_first, key=locals_by_first.get), start=1):
            mapping[(windows[0].window_index, local)] = f"spk:{effective_run_id}:{ordinal}"
    else:
        clusters = _cluster_observations(observations, effective_threshold)
        for ordinal, cluster in enumerate(clusters, start=1):
            final_id = f"spk:{effective_run_id}:{ordinal}"
            for obs in cluster.observations:
                mapping[(obs.window_index, obs.local_id)] = final_id

    finalized: list[TranscriptionSegment] = []
    for window in windows:
        for segment in window.segments:
            local = normalize_local_speaker_id(segment.speaker_id)
            final_id = mapping.get((window.window_index, local)) if local is not None else None
            finalized.append(segment.model_copy(update={"speaker_id": final_id}))

    speaker_ids = {segment.speaker_id for segment in finalized if segment.speaker_id}
    if any(
        segment.speaker_id and not segment.speaker_id.startswith("spk:")
        for segment in finalized
    ):
        warnings.append("speaker_local_id_leaked")
    return finalized, DiarizationInfo(
        status="final",
        run_id=effective_run_id,
        speaker_count=len(speaker_ids),
        warnings=warnings,
    )


def strip_speaker_ids(segments: list[TranscriptionSegment]) -> list[TranscriptionSegment]:
    return [segment.model_copy(update={"speaker_id": None}) for segment in segments]
