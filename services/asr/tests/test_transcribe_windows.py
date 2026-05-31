from __future__ import annotations

from pathlib import Path

import pytest

from rushi_asr.schemas import TranscriptionSegment
from rushi_asr import transcribe_windows


def test_plan_windows_even_slices() -> None:
    assert transcribe_windows.plan_windows(900.0, 300.0) == [
        (0.0, 300.0),
        (300.0, 300.0),
        (600.0, 300.0),
    ]


def test_plan_windows_tail_slice() -> None:
    assert transcribe_windows.plan_windows(650.0, 300.0) == [
        (0.0, 300.0),
        (300.0, 300.0),
        (600.0, 50.0),
    ]


def test_should_transcribe_by_windows_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_WINDOW_THRESHOLD_SEC", "1800")
    assert transcribe_windows.should_transcribe_by_windows(1799.0) is False
    assert transcribe_windows.should_transcribe_by_windows(1800.0) is True
    assert transcribe_windows.should_transcribe_by_windows(None) is False


def test_should_transcribe_by_windows_async_uses_async_window_sec(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RUSHI_FUNASR_ASYNC_WINDOW_SEC", raising=False)
    monkeypatch.delenv("RUSHI_FUNASR_ASYNC_WINDOW_THRESHOLD_SEC", raising=False)
    assert transcribe_windows.async_window_sec() == 120.0
    assert transcribe_windows.should_transcribe_by_windows_async(1200.0) is True
    assert transcribe_windows.should_transcribe_by_windows_async(119.0) is False
    assert transcribe_windows.plan_windows(1200.0, 120.0) == [
        (0.0, 120.0),
        (120.0, 120.0),
        (240.0, 120.0),
        (360.0, 120.0),
        (480.0, 120.0),
        (600.0, 120.0),
        (720.0, 120.0),
        (840.0, 120.0),
        (960.0, 120.0),
        (1080.0, 120.0),
    ]


def test_async_window_sec_overrides_blocking_window(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_WINDOW_SEC", "300")
    monkeypatch.setenv("RUSHI_FUNASR_ASYNC_WINDOW_SEC", "90")
    assert transcribe_windows.window_sec() == 300.0
    assert transcribe_windows.async_window_sec() == 90.0
    assert transcribe_windows.should_transcribe_by_windows_async(90.0) is True


def test_offset_and_merge_segments() -> None:
    base = [
        TranscriptionSegment(start_sec=1.0, end_sec=2.0, text="a"),
        TranscriptionSegment(start_sec=0.5, end_sec=1.5, text="b"),
    ]
    shifted = transcribe_windows.offset_segments(base, 300.0)
    assert shifted[0].start_sec == 301.0
    merged = transcribe_windows.merge_window_segments(shifted)
    assert [s.start_sec for s in merged] == [300.5, 301.0]


def test_transcribe_by_windows_merges_with_offset(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    wav = tmp_path / "normalized.wav"
    wav.write_bytes(b"wav")

    calls: list[tuple[float | None, Path]] = []

    def fake_generate(
        slice_path: Path,
        duration_sec: float | None,
        hotwords: str | None,
        out_warnings: list[str] | None,
    ) -> tuple[list[TranscriptionSegment], str, str | None]:
        calls.append((duration_sec, slice_path))
        local_start = 0.0 if duration_sec == 300.0 else 0.0
        return (
            [
                TranscriptionSegment(
                    start_sec=local_start + 1.0,
                    end_sec=local_start + 2.0,
                    text=f"seg-{len(calls)}",
                ),
            ],
            "funasr+test-model",
            "sentence_info",
        )

    monkeypatch.setattr(
        "rushi_asr.funasr_engine.generate_and_parse_funasr",
        fake_generate,
    )
    monkeypatch.setattr(
        "rushi_asr.ffmpeg_audio.extract_wav_segment",
        lambda src, dst, start, dur: dst.write_bytes(b"s"),
    )

    warnings: list[str] = []
    segs, engine, mode = transcribe_windows.transcribe_by_windows(
        wav,
        650.0,
        hotwords="foo",
        out_warnings=warnings,
    )

    assert engine == "funasr+test-model"
    assert mode == "transcribe_windowed"
    assert len(calls) == 3
    assert calls[0][0] == 300.0
    assert calls[2][0] == 50.0
    assert [s.start_sec for s in segs] == [1.0, 301.0, 601.0]
    assert any("transcribe_windowed:windows=3" in w for w in warnings)
    assert not (tmp_path / ".rushi_transcribe_windows").exists()


def test_transcribe_by_windows_propagates_generate_failure(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    wav = tmp_path / "normalized.wav"
    wav.write_bytes(b"wav")

    def fail_generate(*_args, **_kwargs):
        raise RuntimeError("funasr_generate_failed:boom")

    monkeypatch.setattr("rushi_asr.funasr_engine.generate_and_parse_funasr", fail_generate)
    monkeypatch.setattr(
        "rushi_asr.ffmpeg_audio.extract_wav_segment",
        lambda *_args, **_kwargs: None,
    )

    with pytest.raises(RuntimeError, match="funasr_generate_failed"):
        transcribe_windows.transcribe_by_windows(wav, 2000.0, out_warnings=[])

    assert not (tmp_path / ".rushi_transcribe_windows").exists()
