from __future__ import annotations

from rushi_asr.schemas import TranscriptionSegment
from rushi_asr.speaker_diarization import (
    ClusteringPolicy,
    SpeakerWindowResult,
    finalize_speaker_windows,
    speaker_centers_from_result,
)


def _seg(start: float, end: float, speaker: str) -> TranscriptionSegment:
    return TranscriptionSegment(
        start_sec=start,
        end_sec=end,
        text=speaker,
        speaker_id=speaker,
    )


def _policy(**overrides: float | int) -> ClusteringPolicy:
    base: dict[str, float | int] = {
        "threshold": 0.8,
        "min_observation_speech_sec": 1.5,
        "min_speaker_speech_sec": 8.0,
        "max_speakers": 10,
        "absorb_floor": 0.2,
    }
    base.update(overrides)
    return ClusteringPolicy(**base)  # type: ignore[arg-type]


def test_speaker_centers_accepts_matrix_and_normalizes() -> None:
    centers = speaker_centers_from_result({"spk_embedding_center": [[3.0, 4.0], [0.0, 2.0]]})
    assert centers["0"] == [0.6, 0.8]
    assert centers["1"] == [0.0, 1.0]


def test_cross_window_clusters_same_voice_and_keeps_run_scoped_ids() -> None:
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 4, "0"), _seg(5, 8, "1")],
            {"0": [1.0, 0.0], "1": [0.0, 1.0]},
        ),
        SpeakerWindowResult(
            2,
            [_seg(120, 124, "1"), _seg(125, 129, "0")],
            {"0": [0.02, 0.999], "1": [0.999, 0.02]},
        ),
    ]
    finalized, info = finalize_speaker_windows(windows, threshold=0.8, run_id="run")
    assert info.status == "final"
    assert info.speaker_count == 2
    assert [segment.speaker_id for segment in finalized] == [
        "spk:run:1",
        "spk:run:2",
        "spk:run:1",
        "spk:run:2",
    ]


def test_same_window_speakers_are_hard_cannot_link() -> None:
    """Two genuine speakers sharing a window must survive as two clusters.

    Durations are well above ``min_speaker_speech_sec`` so the small-cluster
    absorption pass cannot merge them; only the phase-1 cannot-link matters.
    """
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 20, "0"), _seg(21, 41, "1")],
            {"0": [1.0, 0.0], "1": [0.999, 0.01]},
        )
    ]
    finalized, info = finalize_speaker_windows(windows, threshold=0.5, run_id="run")
    assert info.speaker_count == 2
    assert finalized[0].speaker_id != finalized[1].speaker_id


def test_multi_window_missing_center_yields_null_not_local_label() -> None:
    windows = [
        SpeakerWindowResult(1, [_seg(0, 1, "0")], {}),
        SpeakerWindowResult(2, [_seg(120, 121, "0")], {}),
    ]
    finalized, info = finalize_speaker_windows(windows, run_id="run")
    assert [segment.speaker_id for segment in finalized] == [None, None]
    assert info.speaker_count == 0
    assert len(info.warnings) == 2


def test_single_window_without_center_can_use_local_recording_labels() -> None:
    finalized, info = finalize_speaker_windows(
        [SpeakerWindowResult(1, [_seg(0, 1, "7"), _seg(2, 3, "9")], {})],
        run_id="run",
    )
    assert [segment.speaker_id for segment in finalized] == ["spk:run:1", "spk:run:2"]
    assert info.speaker_count == 2


def _distinct_windows(count: int, *, duration: float = 20.0) -> list[SpeakerWindowResult]:
    """One window per speaker, mutually orthogonal centers so nothing merges."""
    windows: list[SpeakerWindowResult] = []
    for index in range(count):
        center = [1.0 if axis == index else 0.0 for axis in range(count)]
        start = index * 100.0
        windows.append(
            SpeakerWindowResult(
                index + 1,
                [_seg(start, start + duration, "0")],
                {"0": center},
            )
        )
    return windows


def test_speaker_count_over_max_is_clamped_with_warning() -> None:
    finalized, info = finalize_speaker_windows(
        _distinct_windows(5),
        run_id="run",
        policy=_policy(max_speakers=2),
    )
    assert info.speaker_count == 2
    assert "speaker_count_clamped:from=5:to=2" in info.warnings
    assert all(segment.speaker_id is not None for segment in finalized)
    assert all(str(segment.speaker_id).startswith("spk:run:") for segment in finalized)


def test_speaker_count_under_max_does_not_warn() -> None:
    _, info = finalize_speaker_windows(
        _distinct_windows(2),
        run_id="run",
        policy=_policy(max_speakers=10),
    )
    assert info.speaker_count == 2
    assert not any(w.startswith("speaker_count_clamped") for w in info.warnings)


def test_dominant_cluster_absorbs_fragment_locked_by_cannot_link() -> None:
    """Regression for the 20-speaker real-audio case.

    The fragment shares a window with the dominant speaker, so phase-1
    cannot-link forbids merging it. The unconstrained small-cluster pass must
    still reclaim it, otherwise every window mints a permanent speaker.
    """
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 60, "0"), _seg(61, 64, "1")],
            {"0": [1.0, 0.0], "1": [1.0, 0.0]},
        )
    ]
    finalized, info = finalize_speaker_windows(windows, run_id="run", policy=_policy())
    assert info.speaker_count == 1
    assert {segment.speaker_id for segment in finalized} == {"spk:run:1"}


def test_sub_second_observation_never_becomes_its_own_speaker() -> None:
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 60, "0"), _seg(61, 61.5, "1")],
            {"0": [1.0, 0.0], "1": [0.0, 1.0]},
        )
    ]
    finalized, info = finalize_speaker_windows(windows, run_id="run", policy=_policy())
    assert info.speaker_count == 1
    assert all(segment.speaker_id == "spk:run:1" for segment in finalized)


def test_small_speaker_floor_adapts_to_short_recordings() -> None:
    """A 6-second recording must not have every cluster eaten by an 8s floor."""
    _, info = finalize_speaker_windows(
        _distinct_windows(2, duration=3.0),
        run_id="run",
        policy=_policy(min_speaker_speech_sec=8.0),
    )
    assert info.speaker_count == 2


def test_all_clusters_below_floor_promotes_the_largest() -> None:
    windows = [
        SpeakerWindowResult(1, [_seg(0, 0.8, "0")], {"0": [1.0, 0.0]}),
        SpeakerWindowResult(2, [_seg(100, 100.4, "0")], {"0": [0.0, 1.0]}),
    ]
    finalized, info = finalize_speaker_windows(windows, run_id="run", policy=_policy())
    assert info.speaker_count == 1
    assert all(segment.speaker_id == "spk:run:1" for segment in finalized)


def test_absorbing_a_dissimilar_fragment_warns_below_floor() -> None:
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 60, "0"), _seg(61, 64, "1")],
            {"0": [1.0, 0.0], "1": [0.0, 1.0]},
        )
    ]
    _, info = finalize_speaker_windows(windows, run_id="run", policy=_policy())
    assert info.speaker_count == 1
    assert any(w.startswith("speaker_absorbed_below_floor:") for w in info.warnings)


def test_small_cluster_absorption_is_recorded_as_warning() -> None:
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 60, "0"), _seg(61, 64, "1")],
            {"0": [1.0, 0.0], "1": [1.0, 0.0]},
        )
    ]
    _, info = finalize_speaker_windows(windows, run_id="run", policy=_policy())
    assert any(w.startswith("speaker_small_clusters_absorbed:") for w in info.warnings)
