from __future__ import annotations

from rushi_asr.model_prepare_progress import ModelPrepareProgressTracker


def test_tracker_percent_from_downloaded_bytes(monkeypatch) -> None:
    monkeypatch.setattr(
        "rushi_asr.model_prepare_progress._RECOGNIZER_BUDGET_BYTES",
        1_000,
    )
    monkeypatch.setattr("rushi_asr.model_prepare_progress._VAD_BUDGET_BYTES", 0)

    tracker = ModelPrepareProgressTracker()
    tracker.reset(include_vad=False)
    assert tracker.snapshot()["progress_percent"] == 0

    tracker.register_file("model.pt", 1_000)
    tracker.add_bytes(500)
    assert tracker.snapshot()["progress_percent"] == 50

    tracker.add_bytes(500)
    assert tracker.snapshot()["progress_percent"] == 99

    tracker.finalize_success()
    assert tracker.snapshot()["progress_percent"] == 100


def test_tracker_includes_forced_aligner_budget(monkeypatch) -> None:
    monkeypatch.setattr(
        "rushi_asr.model_prepare_progress._RECOGNIZER_BUDGET_BYTES",
        1_000,
    )
    monkeypatch.setattr("rushi_asr.model_prepare_progress._VAD_BUDGET_BYTES", 0)
    monkeypatch.setattr("rushi_asr.model_prepare_progress._PUNC_BUDGET_BYTES", 0)
    monkeypatch.setattr(
        "rushi_asr.model_prepare_progress._FORCED_ALIGNER_BUDGET_BYTES",
        700,
    )

    tracker = ModelPrepareProgressTracker()
    tracker.reset(include_vad=False, include_forced_aligner=True)
    assert tracker.snapshot()["bytes_total"] == 1_700


def test_tracker_budget_used_when_no_file_sizes_yet() -> None:
    tracker = ModelPrepareProgressTracker()
    tracker.reset(include_vad=False)
    tracker.add_bytes(1)
    snap = tracker.snapshot()
    assert snap["bytes_total"] >= 130 * 1024 * 1024
    assert snap["progress_percent"] == 0
