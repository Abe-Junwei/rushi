from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from rushi_asr.schemas import TranscriptionSegment
from rushi_asr.transcribe_job import (
    cancel_transcribe,
    reset_transcribe_jobs_for_tests,
    start_transcribe_async,
    transcribe_status,
)


@pytest.fixture(autouse=True)
def _clear_jobs() -> None:
    reset_transcribe_jobs_for_tests()
    yield
    reset_transcribe_jobs_for_tests()


def test_transcribe_status_unknown_job() -> None:
    body = transcribe_status("missing")
    assert body["phase"] == "unknown"
    assert body["error"]["code"] == "unknown_job"


def test_async_job_emits_window_deltas(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    upload = tmp_path / "in.wav"
    upload.write_bytes(b"wav")
    work = tmp_path / "work"
    work.mkdir()

    window_calls: list[tuple[int, int, list[TranscriptionSegment]]] = []

    def fake_transcribe(
        upload_path: Path,
        work_dir: Path,
        hotwords: str | None,
        *,
        on_window_done,
        should_cancel,
        on_phase,
        on_windows_planned=None,
    ):
        from rushi_asr.schemas import TranscriptionResult

        on_phase("transcribing", "transcribing")
        for i in range(1, 4):
            delta = [
                TranscriptionSegment(
                    start_sec=float(i),
                    end_sec=float(i) + 1.0,
                    text=f"w{i}",
                ),
            ]
            on_window_done(i, 3, delta)
            window_calls.append((i, 3, delta))
        return TranscriptionResult(
            segments=[s for _, _, ds in window_calls for s in ds],
            full_text="w1w2w3",
            engine="funasr+test",
            duration_sec=900.0,
            warnings=["transcribe_windowed:windows=3"],
            segmentation_mode="transcribe_windowed",
        )

    with patch("rushi_asr.transcribe_job._transcribe_with_progress", fake_transcribe):
        started = start_transcribe_async(upload, work, None)
    job_id = started["job_id"]

    import time

    deadline = time.time() + 5.0
    seen_total = 0
    all_delta_texts: list[str] = []
    while time.time() < deadline:
        st = transcribe_status(job_id)
        phase = st["phase"]
        for row in st.get("segments_delta", []):
            all_delta_texts.append(row["text"])
        seen_total = max(seen_total, st.get("segments_total", 0))
        if phase in ("done", "error", "cancelled"):
            break
        time.sleep(0.05)

    assert transcribe_status(job_id)["phase"] == "done"
    assert seen_total == 3
    assert all_delta_texts == ["w1", "w2", "w3"]
    final = transcribe_status(job_id)
    assert final["window_count"] == 3
    assert final["engine"] == "funasr+test"


def test_async_job_plans_window_count_before_first_delta(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path,
) -> None:
    upload = tmp_path / "in.wav"
    upload.write_bytes(b"wav")
    work = tmp_path / "work3"
    work.mkdir()

    def fake_transcribe(
        upload_path: Path,
        work_dir: Path,
        hotwords: str | None,
        *,
        on_window_done,
        should_cancel,
        on_phase,
        on_windows_planned,
    ):
        from rushi_asr.schemas import TranscriptionResult

        on_phase("transcribing", "transcribing")
        if on_windows_planned:
            on_windows_planned(3)
        import time

        time.sleep(0.15)
        on_window_done(1, 3, [])
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="funasr+test",
            duration_sec=900.0,
            warnings=[],
            segmentation_mode="transcribe_windowed",
        )

    with patch("rushi_asr.transcribe_job._transcribe_with_progress", fake_transcribe):
        started = start_transcribe_async(upload, work, None)
    job_id = started["job_id"]

    import time

    deadline = time.time() + 3.0
    saw_planned = False
    while time.time() < deadline:
        st = transcribe_status(job_id)
        if st.get("window_count") == 3 and st.get("phase") == "transcribing":
            saw_planned = True
            break
        if st["phase"] in ("done", "error", "cancelled"):
            break
        time.sleep(0.02)

    assert saw_planned


def test_cancel_transcribe_marks_job(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    upload = tmp_path / "in.wav"
    upload.write_bytes(b"wav")
    work = tmp_path / "work2"
    work.mkdir()

    def slow_transcribe(*_args, **_kwargs):
        import time

        from rushi_asr.schemas import TranscriptionResult
        from rushi_asr.transcribe_windows import TranscribeCancelledError

        time.sleep(0.2)
        raise TranscribeCancelledError()

    with patch("rushi_asr.transcribe_job._transcribe_with_progress", slow_transcribe):
        started = start_transcribe_async(upload, work, None)
    job_id = started["job_id"]
    cancel_transcribe(job_id)

    import time

    deadline = time.time() + 5.0
    phase = "running"
    while time.time() < deadline:
        phase = transcribe_status(job_id)["phase"]
        if phase in ("cancelled", "error", "done"):
            break
        time.sleep(0.05)
    assert phase == "cancelled"


def test_async_job_rejects_second_active_job(tmp_path: Path) -> None:
    upload = tmp_path / "in.wav"
    upload.write_bytes(b"wav")
    first_work = tmp_path / "work-active-1"
    second_work = tmp_path / "work-active-2"
    first_work.mkdir()
    second_work.mkdir()

    def slow_transcribe(*_args, **_kwargs):
        import time

        time.sleep(0.5)
        from rushi_asr.schemas import TranscriptionResult

        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="funasr+test",
            duration_sec=1.0,
            warnings=[],
        )

    with patch("rushi_asr.transcribe_job._transcribe_with_progress", slow_transcribe):
        start_transcribe_async(upload, first_work, None)
        with pytest.raises(RuntimeError, match="transcribe_job_limit"):
            start_transcribe_async(upload, second_work, None)
