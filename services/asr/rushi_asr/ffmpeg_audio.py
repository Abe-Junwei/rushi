"""FFmpeg / ffprobe helpers for local audio normalization (P0 pipeline)."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from rushi_asr.transcribe_timeouts import pipeline_timeout_sec


def _pyinstaller_bundle_dirs() -> list[Path]:
    """Return candidate onedir locations for bundled binaries.

    PyInstaller 6 onedir defaults to `contents-directory=_internal`, so binaries may
    live either next to the main executable or under `_internal` / `sys._MEIPASS`.
    """
    if not getattr(sys, "frozen", False):
        return []

    exe_dir = Path(sys.executable).resolve().parent
    dirs = [exe_dir, exe_dir / "_internal"]

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        dirs.append(Path(meipass).resolve())

    unique: list[Path] = []
    seen: set[Path] = set()
    for d in dirs:
        if d not in seen:
            seen.add(d)
            unique.append(d)
    return unique


def _bundled_binary(*names: str) -> str | None:
    for d in _pyinstaller_bundle_dirs():
        for n in names:
            p = d / n
            if p.is_file():
                return str(p)
    return None


def ffmpeg_path() -> str:
    p = _bundled_binary("ffmpeg", "ffmpeg.exe")
    if p is not None:
        return p
    w = shutil.which("ffmpeg")
    return w if w else "ffmpeg"


def ffprobe_path() -> str:
    p = _bundled_binary("ffprobe", "ffprobe.exe")
    if p is not None:
        return p
    w = shutil.which("ffprobe")
    return w if w else "ffprobe"


def ffmpeg_available() -> bool:
    if _pyinstaller_bundle_dirs():
        return (
            _bundled_binary("ffmpeg", "ffmpeg.exe") is not None
            and _bundled_binary("ffprobe", "ffprobe.exe") is not None
        )
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def ffprobe_duration_sec(path: Path) -> float | None:
    """Return container duration in seconds, or None if unknown."""
    try:
        out = subprocess.run(
            [
                ffprobe_path(),
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    raw = (out.stdout or "").strip()
    if not raw or raw == "N/A":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def normalize_to_wav_16k_mono(
    src: Path,
    dst_wav: Path,
    *,
    timeout_sec: int | None = None,
) -> None:
    """Decode / resample to 16 kHz mono s16le WAV via ffmpeg."""
    dst_wav.parent.mkdir(parents=True, exist_ok=True)
    budget = timeout_sec or pipeline_timeout_sec(ffprobe_duration_sec(src))
    cmd = [
        ffmpeg_path(),
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        str(dst_wav),
    ]
    try:
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            timeout=budget,
        )
    except FileNotFoundError as e:
        raise RuntimeError("ffmpeg_not_found") from e
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or "").strip()
        raise RuntimeError(f"ffmpeg_failed:{err[:800]}") from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"ffmpeg_timeout:{budget}") from e
