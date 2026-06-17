#!/usr/bin/env python3
"""R3g-C Fun-ASR-Nano spike: Paraformer vs Fun-ASR-Nano-2512 transcribe comparison."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASR_DIR = ROOT / "services" / "asr"
sys.path.insert(0, str(ASR_DIR))

from rushi_asr.engine import transcribe_upload  # noqa: E402
from rushi_asr.eval_metrics import term_hit_rate  # noqa: E402

PARAFORMER = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
NANO = "FunAudioLLM/Fun-ASR-Nano-2512"
DEFAULT_LONG = ROOT / "fixtures/eval/samples/制控.mp3"
DEFAULT_SHORT = ROOT / "fixtures/eval/samples/clear.wav"


def _apply_models_root() -> None:
    if os.environ.get("RUSHI_MODELS_ROOT"):
        return
    home = Path.home()
    legacy = home / "Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models"
    if legacy.is_dir():
        os.environ["RUSHI_MODELS_ROOT"] = str(legacy)
        os.environ.setdefault("MODELSCOPE_CACHE", str(legacy / "modelscope"))


def _run(model_id: str, audio: Path, hotwords: str | None = None) -> dict:
    os.environ["RUSHI_FUNASR_MODEL"] = model_id
    t0 = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="funasr_nano_spike_") as tmp:
        result = transcribe_upload(audio, Path(tmp), hotwords)
    elapsed = time.monotonic() - t0
    payload = result.model_dump()
    payload["_spike_wall_sec"] = round(elapsed, 1)
    payload["_spike_model_id"] = model_id
    return payload


def _summarize(label: str, d: dict) -> dict:
    segs = d.get("segments") or []
    warn = d.get("warnings") or []
    fb = any("funasr_whole_track_fallback" in str(w) for w in warn)
    text0 = (segs[0].get("text") or "")[:80] if segs else ""
    return {
        "label": label,
        "segments": len(segs),
        "engine": d.get("engine"),
        "duration_sec": d.get("duration_sec"),
        "wall_sec": d.get("_spike_wall_sec"),
        "whole_track_fallback": fb,
        "warnings_head": warn[:6],
        "first_text_80": text0,
        "first_start": segs[0].get("start_sec") if segs else None,
        "last_end": segs[-1].get("end_sec") if segs else None,
    }


def main() -> int:
    _apply_models_root()
    out_dir = Path(os.environ.get("SPIKE_OUT_DIR", ROOT / "docs/execution/spike-output/funasr-nano-2026-06-17"))
    out_dir.mkdir(parents=True, exist_ok=True)

    long_audio = Path(os.environ.get("SPIKE_LONG_AUDIO", str(DEFAULT_LONG)))
    short_audio = Path(os.environ.get("SPIKE_SHORT_AUDIO", str(DEFAULT_SHORT)))
    skip_long = "--skip-long" in sys.argv
    force_windowed = "--force-windowed" in sys.argv

    if force_windowed:
        os.environ.setdefault("RUSHI_FUNASR_WINDOW_THRESHOLD_SEC", "1")
        os.environ.setdefault("RUSHI_FUNASR_WINDOW_SEC", os.environ.get("SPIKE_WINDOW_SEC", "120"))
        os.environ.setdefault("RUSHI_FUNASR_WINDOW_OVERLAP_SEC", "0")

    if not long_audio.is_file():
        print(f"FAIL: long audio missing: {long_audio}", file=sys.stderr)
        return 1

    report: dict = {
        "long_audio": str(long_audio),
        "short_audio": str(short_audio),
        "force_windowed": force_windowed,
        "window_sec": os.environ.get("RUSHI_FUNASR_WINDOW_SEC"),
        "runs": [],
    }

    for model, name in ((PARAFORMER, "paraformer"), (NANO, "nano")):
        print(f"==> S2 short {name} …", flush=True)
        d = _run(model, short_audio)
        (out_dir / f"s2-short-{name}.json").write_text(
            json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        report["runs"].append(_summarize(f"S2-{name}", d))

    for model, name in ((PARAFORMER, "paraformer"), (NANO, "nano")):
        print(f"==> S3 制控 hotwords {name} …", flush=True)
        d = _run(model, long_audio, hotwords="制控")
        (out_dir / f"s3-zhikong-{name}.json").write_text(
            json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        full = d.get("full_text") or ""
        for seg in d.get("segments") or []:
            full += " " + (seg.get("text") or "")
        hit = term_hit_rate(full, ["制控"])
        s = _summarize(f"S3-{name}", d)
        s["term_hit_rate"] = hit
        report["runs"].append(s)

    if not skip_long:
        for model, name in ((PARAFORMER, "paraformer"), (NANO, "nano")):
            print(f"==> S1 long {name} ({long_audio.name}) …", flush=True)
            d = _run(model, long_audio)
            (out_dir / f"s1-long-{name}.json").write_text(
                json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            report["runs"].append(_summarize(f"S1-{name}", d))

    (out_dir / "spike-summary.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
