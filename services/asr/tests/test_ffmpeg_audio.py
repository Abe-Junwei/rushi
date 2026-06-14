from __future__ import annotations

import os
import shutil
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
    assert ffmpeg_audio.ffmpeg_on_path() is True
    assert Path(ffmpeg_audio.ffmpeg_path()).name == "ffmpeg"
    assert Path(ffmpeg_audio.ffprobe_path()).name == "ffprobe"


def test_ensure_ffmpeg_on_path_prepends_bundle_dir(monkeypatch, tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    internal = bundle / "_internal"
    internal.mkdir(parents=True)
    ffmpeg = internal / "ffmpeg"
    ffprobe = internal / "ffprobe"
    ffmpeg.write_text("")
    ffprobe.write_text("")

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "executable", str(bundle / "rushi-asr-sidecar"), raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(internal), raising=False)
    monkeypatch.setenv("PATH", "/usr/bin")
    monkeypatch.setattr(
        shutil,
        "which",
        lambda name: str(internal / name) if (internal / name).is_file() else None,
    )

    ffmpeg_audio.ensure_ffmpeg_on_path()
    assert str(internal) in os.environ["PATH"].split(os.pathsep)
    assert ffmpeg_audio.ffmpeg_on_path() is True
