#!/usr/bin/env python3
"""Phase 0: Paraformer (product path) vs FunASR-embedded Whisper (±ct-punc) on same audio.

Research: docs/execution/specs/r3g-whisper-funasr-sku-compare-research.md
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import sys
import tempfile
import time
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
ASR_DIR = ROOT / "services" / "asr"
sys.path.insert(0, str(ASR_DIR))

from rushi_asr.defaults import (  # noqa: E402
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
)
from rushi_asr.engine import transcribe_upload  # noqa: E402
from rushi_asr.eval_metrics import (  # noqa: E402
    cer_chars,
    content_cer_chars,
    rtfx,
    term_hit_rate,
)
from rushi_asr.ffmpeg_audio import ffprobe_duration_sec  # noqa: E402
from rushi_asr.segmentation import segment_funasr_generate_result  # noqa: E402

PARAFORMER = DEFAULT_FUNASR_MODEL_ID
WHISPER_TURBO = "Whisper-large-v3-turbo"
WHISPER_LARGE = "Whisper-large-v3"
VAD_MODEL = DEFAULT_FUNASR_VAD_MODEL_ID
PUNC_MODEL = DEFAULT_FUNASR_PUNC_MODEL_ID

DEFAULT_SHORT = ROOT / "fixtures/eval/samples/clear.wav"
DEFAULT_LONG = ROOT / "fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3"
DEFAULT_LONG_REF = ROOT / "fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt"
DEFAULT_TERM = ROOT / "fixtures/eval/samples/制控.mp3"
DEFAULT_OUT = ROOT / "docs/execution/spike-output/whisper-funasr-compare"


def _apply_models_root() -> None:
    if os.environ.get("RUSHI_MODELS_ROOT"):
        return
    home = Path.home()
    legacy = home / "Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models"
    if legacy.is_dir():
        os.environ["RUSHI_MODELS_ROOT"] = str(legacy)
        os.environ.setdefault("MODELSCOPE_CACHE", str(legacy / "modelscope"))
        return
    alt = home / "Library/Application Support/studio.lingchuang.rushi/models"
    if alt.is_dir():
        os.environ["RUSHI_MODELS_ROOT"] = str(alt)
        os.environ.setdefault("MODELSCOPE_CACHE", str(alt / "modelscope"))


def _require_openai_whisper() -> None:
    try:
        import whisper  # noqa: F401
    except ImportError as e:
        print(
            "FAIL: openai-whisper not installed.\n"
            "  pip install openai-whisper\n"
            "(Phase 0 does not modify sidecar lockfiles.)",
            file=sys.stderr,
        )
        raise SystemExit(2) from e


def _resolve_device() -> str:
    raw = os.environ.get("RUSHI_FUNASR_DEVICE", "").strip()
    if raw:
        return raw
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda:0"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _punct_density(text: str) -> float:
    if not text:
        return 0.0
    punct = sum(1 for ch in text if unicodedata.category(ch).startswith("P"))
    return round(punct / len(text), 4)


def _concat_text(segments: list[dict[str, Any]], full_text: str = "") -> str:
    if full_text.strip():
        return full_text.strip()
    parts = [(s.get("text") or "").strip() for s in segments if (s.get("text") or "").strip()]
    return "".join(parts)


def _seg_dicts(segments: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in segments:
        if hasattr(s, "model_dump"):
            out.append(s.model_dump())
        elif isinstance(s, dict):
            out.append(s)
    return out


def _base_summary(
    *,
    run_id: str,
    sample: str,
    model_id: str,
    wall_sec: float,
    duration_sec: float | None,
    segments: list[dict[str, Any]],
    warnings: list[str],
    segmentation_mode: str | None,
    full_text: str,
    raw_keys: list[str] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    fb = any("funasr_whole_track_fallback" in str(w) for w in warnings)
    failed = (not segments) or (segmentation_mode in (None, "empty"))
    text = _concat_text(segments, full_text)
    first = segments[0] if segments else None
    last = segments[-1] if segments else None
    row: dict[str, Any] = {
        "run_id": run_id,
        "sample": sample,
        "model_id": model_id,
        "wall_sec": round(wall_sec, 1),
        "duration_sec": duration_sec,
        "rtfx": rtfx(duration_sec, wall_sec),
        "segment_count": len(segments),
        "segmentation_mode": segmentation_mode,
        "whole_track_fallback": fb,
        "segmentation_failed": failed and not fb,
        "punct_density": _punct_density(text),
        "warnings_head": warnings[:8],
        "first_text_80": (first.get("text") or "")[:80] if first else "",
        "full_text_preview": text[:200],
        "first_start": first.get("start_sec") if first else None,
        "last_end": last.get("end_sec") if last else None,
        "raw_keys": raw_keys or [],
    }
    if extra:
        row.update(extra)
    return row


def _run_paraformer(audio: Path, hotwords: str | None = None) -> dict[str, Any]:
    os.environ["RUSHI_FUNASR_MODEL"] = PARAFORMER
    t0 = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="whisper_compare_pf_") as tmp:
        result = transcribe_upload(audio, Path(tmp), hotwords)
    wall = time.monotonic() - t0
    payload = result.model_dump()
    payload["_spike_wall_sec"] = round(wall, 1)
    payload["_spike_model_id"] = PARAFORMER
    return payload


def _run_whisper_automodel(
    audio: Path,
    *,
    model_id: str,
    with_punc: bool,
) -> dict[str, Any]:
    from funasr import AutoModel

    device = _resolve_device()
    use_fp16 = device.startswith("cuda")
    kwargs: dict[str, Any] = {
        "model": model_id,
        "vad_model": VAD_MODEL,
        "vad_kwargs": {"max_single_segment_time": 30000},
        "device": device,
        "disable_update": True,
    }
    if with_punc:
        kwargs["punc_model"] = PUNC_MODEL

    duration = ffprobe_duration_sec(audio)
    warnings: list[str] = []
    t0 = time.monotonic()
    model = AutoModel(**kwargs)
    try:
        decoding = {
            "task": "transcribe",
            "language": "zh",
            "beam_size": None,
            "fp16": use_fp16,
            "without_timestamps": False,
            "prompt": None,
        }
        res = model.generate(
            input=str(audio),
            batch_size_s=0,
            DecodingOptions=decoding,
        )
    finally:
        del model
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass
    wall = time.monotonic() - t0

    if not res:
        return {
            "segments": [],
            "full_text": "",
            "duration_sec": duration,
            "warnings": ["whisper_generate_empty"],
            "segmentation_mode": "empty",
            "raw_keys": [],
            "_spike_wall_sec": round(wall, 1),
            "_spike_model_id": model_id,
            "_spike_device": device,
        }

    r0 = res[0] if isinstance(res[0], dict) else {}
    raw_keys = sorted(str(k) for k in r0.keys())
    segs, mode = segment_funasr_generate_result(
        r0,
        duration,
        model_id,
        out_warnings=warnings,
    )
    seg_dicts = _seg_dicts(segs)
    full = str(r0.get("text") or "").strip()
    if not full:
        full = _concat_text(seg_dicts, "")
    return {
        "segments": seg_dicts,
        "full_text": full,
        "duration_sec": duration,
        "warnings": warnings,
        "segmentation_mode": mode,
        "raw_keys": raw_keys,
        "raw_result0": {k: r0[k] for k in r0 if k in ("text", "sentence_info", "timestamp")},
        "_spike_wall_sec": round(wall, 1),
        "_spike_model_id": model_id,
        "_spike_device": device,
        "_spike_with_punc": with_punc,
    }


def _attach_cer(row: dict[str, Any], hyp: str, reference: str | None) -> None:
    if not reference:
        return
    row["cer_chars"] = round(cer_chars(reference, hyp), 4)
    row["content_cer_chars"] = round(content_cer_chars(reference, hyp), 4)


def _whisper_runs(*, include_large: bool) -> list[tuple[str, str, bool]]:
    runs = [
        ("whisper_turbo_vad", WHISPER_TURBO, False),
        ("whisper_turbo_vad_punc", WHISPER_TURBO, True),
    ]
    if include_large:
        runs.append(("whisper_large_vad_punc", WHISPER_LARGE, True))
    return runs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="FunASR Whisper vs Paraformer Phase 0 compare")
    parser.add_argument("--short-only", action="store_true")
    parser.add_argument("--skip-long", action="store_true")
    parser.add_argument("--skip-term", action="store_true")
    parser.add_argument("--include-large", action="store_true")
    args = parser.parse_args(argv)

    _apply_models_root()
    _require_openai_whisper()

    out_dir = Path(os.environ.get("SPIKE_OUT_DIR", str(DEFAULT_OUT)))
    out_dir.mkdir(parents=True, exist_ok=True)

    short_audio = Path(os.environ.get("SPIKE_SHORT_AUDIO", str(DEFAULT_SHORT)))
    long_audio = Path(os.environ.get("SPIKE_LONG_AUDIO", str(DEFAULT_LONG)))
    long_ref_path = Path(os.environ.get("SPIKE_LONG_REF", str(DEFAULT_LONG_REF)))
    term_audio = Path(os.environ.get("SPIKE_TERM_AUDIO", str(DEFAULT_TERM)))

    if not short_audio.is_file():
        print(f"FAIL: short audio missing: {short_audio}", file=sys.stderr)
        return 1

    long_ref = long_ref_path.read_text(encoding="utf-8") if long_ref_path.is_file() else None
    whisper_specs = _whisper_runs(include_large=args.include_large)
    report: dict[str, Any] = {
        "short_audio": str(short_audio),
        "long_audio": str(long_audio),
        "term_audio": str(term_audio),
        "device": _resolve_device(),
        "models_root": os.environ.get("RUSHI_MODELS_ROOT"),
        "runs": [],
    }

    def _persist(name: str, payload: dict[str, Any], summary: dict[str, Any]) -> None:
        (out_dir / f"{name}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        report["runs"].append(summary)
        print(json.dumps(summary, ensure_ascii=False), flush=True)

    # --- short ---
    print("==> short paraformer_product …", flush=True)
    pf_short = _run_paraformer(short_audio)
    segs = _seg_dicts(pf_short.get("segments") or [])
    s = _base_summary(
        run_id="paraformer_product",
        sample="short",
        model_id=PARAFORMER,
        wall_sec=float(pf_short.get("_spike_wall_sec") or 0),
        duration_sec=pf_short.get("duration_sec"),
        segments=segs,
        warnings=list(pf_short.get("warnings") or []),
        segmentation_mode=pf_short.get("segmentation_mode"),
        full_text=str(pf_short.get("full_text") or ""),
    )
    _persist("short-paraformer_product", pf_short, s)

    for run_id, mid, with_punc in whisper_specs:
        print(f"==> short {run_id} …", flush=True)
        try:
            wh = _run_whisper_automodel(short_audio, model_id=mid, with_punc=with_punc)
        except Exception as e:
            summary = {
                "run_id": run_id,
                "sample": "short",
                "model_id": mid,
                "error": f"{type(e).__name__}: {e}",
                "segment_count": 0,
                "segmentation_failed": True,
            }
            _persist(f"short-{run_id}", {"error": str(e)}, summary)
            continue
        segs = _seg_dicts(wh.get("segments") or [])
        s = _base_summary(
            run_id=run_id,
            sample="short",
            model_id=mid,
            wall_sec=float(wh.get("_spike_wall_sec") or 0),
            duration_sec=wh.get("duration_sec"),
            segments=segs,
            warnings=list(wh.get("warnings") or []),
            segmentation_mode=wh.get("segmentation_mode"),
            full_text=str(wh.get("full_text") or ""),
            raw_keys=list(wh.get("raw_keys") or []),
            extra={"device": wh.get("_spike_device"), "with_punc": with_punc},
        )
        _persist(f"short-{run_id}", wh, s)

    if args.short_only:
        (out_dir / "compare-summary.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    # --- long CER ---
    if not args.skip_long:
        if not long_audio.is_file():
            print(f"WARN: long audio missing, skip: {long_audio}", flush=True)
        else:
            print("==> long paraformer_product …", flush=True)
            pf_long = _run_paraformer(long_audio)
            segs = _seg_dicts(pf_long.get("segments") or [])
            hyp = _concat_text(segs, str(pf_long.get("full_text") or ""))
            s = _base_summary(
                run_id="paraformer_product",
                sample="long",
                model_id=PARAFORMER,
                wall_sec=float(pf_long.get("_spike_wall_sec") or 0),
                duration_sec=pf_long.get("duration_sec"),
                segments=segs,
                warnings=list(pf_long.get("warnings") or []),
                segmentation_mode=pf_long.get("segmentation_mode"),
                full_text=str(pf_long.get("full_text") or ""),
            )
            _attach_cer(s, hyp, long_ref)
            _persist("long-paraformer_product", pf_long, s)

            for run_id, mid, with_punc in whisper_specs:
                print(f"==> long {run_id} …", flush=True)
                try:
                    wh = _run_whisper_automodel(long_audio, model_id=mid, with_punc=with_punc)
                except Exception as e:
                    summary = {
                        "run_id": run_id,
                        "sample": "long",
                        "model_id": mid,
                        "error": f"{type(e).__name__}: {e}",
                        "segment_count": 0,
                        "segmentation_failed": True,
                    }
                    _persist(f"long-{run_id}", {"error": str(e)}, summary)
                    continue
                segs = _seg_dicts(wh.get("segments") or [])
                hyp = _concat_text(segs, str(wh.get("full_text") or ""))
                s = _base_summary(
                    run_id=run_id,
                    sample="long",
                    model_id=mid,
                    wall_sec=float(wh.get("_spike_wall_sec") or 0),
                    duration_sec=wh.get("duration_sec"),
                    segments=segs,
                    warnings=list(wh.get("warnings") or []),
                    segmentation_mode=wh.get("segmentation_mode"),
                    full_text=str(wh.get("full_text") or ""),
                    raw_keys=list(wh.get("raw_keys") or []),
                    extra={"device": wh.get("_spike_device"), "with_punc": with_punc},
                )
                _attach_cer(s, hyp, long_ref)
                _persist(f"long-{run_id}", wh, s)

    # --- term hit ---
    if not args.skip_term:
        if not term_audio.is_file():
            print(f"WARN: term audio missing, skip: {term_audio}", flush=True)
        else:
            print("==> term paraformer_product …", flush=True)
            pf_term = _run_paraformer(term_audio, hotwords="制控")
            segs = _seg_dicts(pf_term.get("segments") or [])
            hyp = _concat_text(segs, str(pf_term.get("full_text") or ""))
            s = _base_summary(
                run_id="paraformer_product",
                sample="term",
                model_id=PARAFORMER,
                wall_sec=float(pf_term.get("_spike_wall_sec") or 0),
                duration_sec=pf_term.get("duration_sec"),
                segments=segs,
                warnings=list(pf_term.get("warnings") or []),
                segmentation_mode=pf_term.get("segmentation_mode"),
                full_text=str(pf_term.get("full_text") or ""),
                extra={"term_hit_rate": term_hit_rate(["制控"], hyp)},
            )
            _persist("term-paraformer_product", pf_term, s)

            for run_id, mid, with_punc in whisper_specs:
                print(f"==> term {run_id} …", flush=True)
                try:
                    wh = _run_whisper_automodel(term_audio, model_id=mid, with_punc=with_punc)
                except Exception as e:
                    summary = {
                        "run_id": run_id,
                        "sample": "term",
                        "model_id": mid,
                        "error": f"{type(e).__name__}: {e}",
                        "segment_count": 0,
                        "segmentation_failed": True,
                    }
                    _persist(f"term-{run_id}", {"error": str(e)}, summary)
                    continue
                segs = _seg_dicts(wh.get("segments") or [])
                hyp = _concat_text(segs, str(wh.get("full_text") or ""))
                s = _base_summary(
                    run_id=run_id,
                    sample="term",
                    model_id=mid,
                    wall_sec=float(wh.get("_spike_wall_sec") or 0),
                    duration_sec=wh.get("duration_sec"),
                    segments=segs,
                    warnings=list(wh.get("warnings") or []),
                    segmentation_mode=wh.get("segmentation_mode"),
                    full_text=str(wh.get("full_text") or ""),
                    raw_keys=list(wh.get("raw_keys") or []),
                    extra={
                        "device": wh.get("_spike_device"),
                        "with_punc": with_punc,
                        "term_hit_rate": term_hit_rate(["制控"], hyp),
                    },
                )
                _persist(f"term-{run_id}", wh, s)

    (out_dir / "compare-summary.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
