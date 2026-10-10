"""Run-scoped speaker ids and cross-window CAM++ center clustering."""

from __future__ import annotations

import math
import os
import uuid
from dataclasses import dataclass
from typing import Any

from rushi_asr.defaults import (
    SPK_ADAPTIVE_FLOOR_MIN_SEC,
    SPK_ADAPTIVE_FLOOR_SPEECH_RATIO,
    effective_spk_absorb_floor,
    effective_spk_max_speakers,
    effective_spk_min_observation_speech_sec,
    effective_spk_min_speaker_speech_sec,
)
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


@dataclass(frozen=True)
class ClusteringPolicy:
    """Guards for run-level clustering.

    ``min_observation_speech_sec`` keeps unreliable short CAM++ centers from
    seeding clusters; ``min_speaker_speech_sec`` and ``max_speakers`` bound the
    final roster. See the rework plan §1 for why the cannot-link constraint alone
    over-fragments real meeting audio.
    """

    threshold: float
    min_observation_speech_sec: float
    min_speaker_speech_sec: float
    max_speakers: int
    absorb_floor: float

    @classmethod
    def from_env(cls, *, threshold: float | None = None) -> ClusteringPolicy:
        return cls(
            threshold=_effective_threshold(threshold),
            min_observation_speech_sec=effective_spk_min_observation_speech_sec(),
            min_speaker_speech_sec=effective_spk_min_speaker_speech_sec(),
            max_speakers=effective_spk_max_speakers(),
            absorb_floor=effective_spk_absorb_floor(),
        )


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


def _seed_cluster(observation: _Observation) -> _Cluster:
    return _Cluster(
        [observation],
        observation.center,
        observation.duration,
        {observation.window_index},
        observation.first_seen,
    )


def _nearest_cluster(orphan: _Cluster, clusters: list[_Cluster]) -> tuple[int, float] | None:
    best: tuple[int, float] | None = None
    for index, cluster in enumerate(clusters):
        similarity = _cosine(orphan.center, cluster.center)
        if best is None or similarity > best[1]:
            best = (index, similarity)
    return best


def _absorb_into_nearest(
    survivors: list[_Cluster],
    orphans: list[_Cluster],
    *,
    floor: float,
    warnings: list[str],
) -> list[_Cluster]:
    """Merge each orphan into its nearest survivor, ignoring cannot-link.

    Dropping the window constraint here is deliberate: it is the only way a
    speaker that FunASR over-split inside a single window can be reassembled,
    and it mirrors how pyannote makes its same-chunk constraint usable.
    """
    if not orphans:
        return survivors
    absorbed_speech = 0.0
    below_floor = 0
    for orphan in sorted(orphans, key=lambda cluster: cluster.weight):
        nearest = _nearest_cluster(orphan, survivors)
        if nearest is None:
            survivors.append(orphan)
            continue
        index, similarity = nearest
        if similarity < floor:
            below_floor += 1
        survivors[index] = _merged_cluster(survivors[index], orphan)
        absorbed_speech += orphan.weight
    warnings.append(
        f"speaker_small_clusters_absorbed:count={len(orphans)}:speech_sec={absorbed_speech:.2f}"
    )
    if below_floor:
        warnings.append(f"speaker_absorbed_below_floor:count={below_floor}")
    return survivors


def _clamp_to_max_speakers(
    clusters: list[_Cluster],
    *,
    max_speakers: int,
    warnings: list[str],
) -> list[_Cluster]:
    if max_speakers < 1 or len(clusters) <= max_speakers:
        return clusters
    before = len(clusters)
    while len(clusters) > max_speakers:
        smallest = min(range(len(clusters)), key=lambda index: clusters[index].weight)
        orphan = clusters.pop(smallest)
        nearest = _nearest_cluster(orphan, clusters)
        if nearest is None:
            clusters.append(orphan)
            break
        index, _ = nearest
        clusters[index] = _merged_cluster(clusters[index], orphan)
    warnings.append(f"speaker_count_clamped:from={before}:to={len(clusters)}")
    return clusters


def _adaptive_speaker_floor(total_speech_sec: float, configured: float) -> float:
    """Shrink the speaker floor on short recordings so it cannot eat every cluster."""
    return min(
        configured,
        max(SPK_ADAPTIVE_FLOOR_MIN_SEC, SPK_ADAPTIVE_FLOOR_SPEECH_RATIO * total_speech_sec),
    )


def _resolve_clusters(
    observations: list[_Observation],
    policy: ClusteringPolicy,
    warnings: list[str],
) -> list[_Cluster]:
    if not observations:
        return []

    reliable = [
        obs for obs in observations if obs.duration >= policy.min_observation_speech_sec
    ]
    short = [obs for obs in observations if obs.duration < policy.min_observation_speech_sec]
    if not reliable:
        reliable, short = observations, []

    candidates = _cluster_observations(reliable, policy.threshold)
    candidates.extend(_seed_cluster(obs) for obs in short)

    floor = _adaptive_speaker_floor(
        sum(obs.duration for obs in observations), policy.min_speaker_speech_sec
    )
    survivors = [cluster for cluster in candidates if cluster.weight >= floor]
    if not survivors:
        survivors = [max(candidates, key=lambda cluster: cluster.weight)]
    survivor_ids = {id(cluster) for cluster in survivors}
    orphans = [cluster for cluster in candidates if id(cluster) not in survivor_ids]

    survivors = _absorb_into_nearest(
        survivors, orphans, floor=policy.absorb_floor, warnings=warnings
    )
    survivors = _clamp_to_max_speakers(
        survivors, max_speakers=policy.max_speakers, warnings=warnings
    )
    return sorted(survivors, key=lambda cluster: cluster.first_seen)


def _effective_threshold(threshold: float | None) -> float:
    if threshold is None:
        try:
            threshold = float(
                os.environ.get(
                    "RUSHI_FUNASR_SPK_SIMILARITY_THRESHOLD", DEFAULT_SIMILARITY_THRESHOLD
                )
            )
        except ValueError:
            threshold = DEFAULT_SIMILARITY_THRESHOLD
    return max(-1.0, min(1.0, threshold))


def _run_id() -> str:
    return uuid.uuid4().hex


def finalize_speaker_windows(
    windows: list[SpeakerWindowResult],
    *,
    threshold: float | None = None,
    run_id: str | None = None,
    policy: ClusteringPolicy | None = None,
) -> tuple[list[TranscriptionSegment], DiarizationInfo]:
    """Map window-local speaker labels to opaque, run-scoped final ids."""
    if not windows:
        return [], DiarizationInfo(status="final", run_id=run_id or _run_id(), speaker_count=0)

    effective_policy = policy or ClusteringPolicy.from_env(threshold=threshold)
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
        clusters = _resolve_clusters(observations, effective_policy, warnings)
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
