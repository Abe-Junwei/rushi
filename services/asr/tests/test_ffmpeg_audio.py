from __future__ import annotations

import sys
from pathlib import Path

from rushi_asr import ffmpeg_audio


def test_ffmpeg_available_detects_pyinstaller_internal(monkeypatch, tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    internal = bundle / "_internal"
    internal.mkdir(parents=True)
    (internal / "ffmpeg").write_text("")
    (internal / "ffprobe").write_text("")

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "executable", str(bundle / "rushi-asr-sidecar"), raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(internal), raising=False)

    assert ffmpeg_audio.ffmpeg_available() is True
    assert Path(ffmpeg_audio.ffmpeg_path()).name == "ffmpeg"
    assert Path(ffmpeg_audio.ffprobe_path()).name == "ffprobe"
