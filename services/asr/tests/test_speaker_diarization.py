from __future__ import annotations

from rushi_asr.schemas import TranscriptionSegment
from rushi_asr.speaker_diarization import (
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
    windows = [
        SpeakerWindowResult(
            1,
            [_seg(0, 1, "0"), _seg(2, 3, "1")],
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
