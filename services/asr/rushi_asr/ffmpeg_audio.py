"""FFmpeg / ffprobe helpers for local audio normalization (P0 pipeline)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def ffmpeg_path() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def ffprobe_path() -> str:
    return shutil.which("ffprobe") or "ffprobe"


def ffmpeg_available() -> bool:
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


def normalize_to_wav_16k_mono(src: Path, dst_wav: Path) -> None:
    """Decode / resample to 16 kHz mono s16le WAV via ffmpeg."""
    dst_wav.parent.mkdir(parents=True, exist_ok=True)
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
            timeout=600,
        )
    except FileNotFoundError as e:
        raise RuntimeError("ffmpeg_not_found") from e
    except subprocess.CalledProcessError as e:
        err = (e.stderr or e.stdout or "").strip()
        raise RuntimeError(f"ffmpeg_failed:{err[:800]}") from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError("ffmpeg_timeout") from e
