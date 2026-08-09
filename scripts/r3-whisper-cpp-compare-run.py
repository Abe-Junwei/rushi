#!/usr/bin/env python3
"""C1 spike: Paraformer product path vs whisper.cpp ggml-large-v3 on same gold audio.

Plan: whisper引擎路线C评估 — does NOT touch catalog / FunASR default.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASR_DIR = ROOT / "services" / "asr"
sys.path.insert(0, str(ASR_DIR))

from rushi_asr.eval_metrics import cer_chars, content_cer_chars, rtfx  # noqa: E402

DEFAULT_LONG = ROOT / "fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3"
DEFAULT_LONG_REF = ROOT / "fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt"
DEFAULT_OUT = ROOT / "docs/execution/spike-output/whisper-cpp-compare"
DEFAULT_WHISPER_CLI = Path.home() / (
    "Library/Application Support/easy-whisper-electron/whisper-workspace/bin/whisper-cli"
)
DEFAULT_MODEL = Path.home() / (
    "Library/Application Support/easy-whisper-electron/whisper-workspace/models/ggml-large-v3.bin"
)
DEFAULT_FFMPEG = Path.home() / (
    "Library/Application Support/easy-whisper-electron/whisper-workspace/bin/ffmpeg"
)
PRIOR_PARAFORMER = (
    ROOT / "docs/execution/spike-output/whisper-funasr-compare/long-paraformer_product.json"
)


def _punct_density(text: str) -> float:
    if not text:
        return 0.0
    punct = sum(1 for ch in text if unicodedata.category(ch).startswith("P"))
    return round(punct / len(text), 4)


def _audio_duration_sec(path: Path, ffmpeg: Path) -> float:
    """Prefer stdlib wave for PCM WAV; else ffprobe; else parse ffmpeg -i."""
    if path.suffix.lower() == ".wav":
        import wave

        with wave.open(str(path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate() or 1
            return frames / float(rate)

    for probe in ("ffprobe",):
        try:
            out = subprocess.check_output(
                [
                    probe,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            return float(out)
        except (FileNotFoundError, subprocess.CalledProcessError, ValueError):
            pass

    bin_ = str(ffmpeg) if ffmpeg.is_file() else "ffmpeg"
    proc = subprocess.run([bin_, "-i", str(path)], capture_output=True, text=True)
    import re

    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr or "")
    if not m:
        raise RuntimeError(f"cannot parse duration for {path}")
    hh, mm, ss = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return hh * 3600 + mm * 60 + ss


def ensure_wav(src: Path, wav: Path, ffmpeg: Path, *, ss: float | None = None, t: float | None = None) -> Path:
    if wav.is_file() and wav.stat().st_mtime >= src.stat().st_mtime:
        return wav
    wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [str(ffmpeg), "-y"]
    if ss is not None:
        cmd += ["-ss", str(ss)]
    cmd += ["-i", str(src)]
    if t is not None:
        cmd += ["-t", str(t)]
    cmd += ["-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav)]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return wav


def parse_whisper_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    transcription = data.get("transcription") or data.get("segments") or []
    segments: list[dict] = []
    texts: list[str] = []
    for item in transcription:
        # whisper.cpp -oj: {offsets:{from,to}, text, timestamps:{from,to}}
        text = (item.get("text") or "").strip()
        if not text:
            continue
        offsets = item.get("offsets") or {}
        ts = item.get("timestamps") or {}
        start_ms = offsets.get("from")
        end_ms = offsets.get("to")
        if start_ms is None and "from" in ts:
            # "00:00:01.000" style — skip; prefer offsets
            start_ms = item.get("t0")
            end_ms = item.get("t1")
        if start_ms is None:
            start_ms = item.get("start", 0)
            if isinstance(start_ms, float) and start_ms < 1000:
                start_ms = int(start_ms * 1000)
            end_ms = item.get("end", start_ms)
            if isinstance(end_ms, float) and end_ms < 10000:
                end_ms = int(float(end_ms) * 1000)
        start_ms = int(start_ms or 0)
        end_ms = int(end_ms or start_ms)
        segments.append({"start_ms": start_ms, "end_ms": end_ms, "text": text})
        texts.append(text)
    full = "".join(texts) if texts else (data.get("text") or "").strip()
    return {
        "segment_count": len(segments),
        "segments": segments,
        "text": full,
        "raw_keys": sorted(data.keys()),
    }


def is_whole_track(segments: list[dict], duration_sec: float) -> bool:
    if len(segments) != 1:
        return False
    span = (segments[0]["end_ms"] - segments[0]["start_ms"]) / 1000.0
    return span >= duration_sec * 0.9


def run_whisper_cli(
    *,
    cli: Path,
    model: Path,
    wav: Path,
    out_prefix: Path,
    language: str,
    threads: int,
    extra_args: list[str] | None = None,
) -> tuple[dict, float]:
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    # whisper-cli writes out_prefix.json when -oj
    cmd = [
        str(cli),
        "-m",
        str(model),
        "-f",
        str(wav),
        "-l",
        language,
        "-t",
        str(threads),
        "-oj",
        "-of",
        str(out_prefix),
    ]
    if extra_args:
        cmd.extend(extra_args)
    t0 = time.perf_counter()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    wall = time.perf_counter() - t0
    (out_prefix.parent / f"{out_prefix.name}.whisper-cli.stderr.log").write_text(
        proc.stderr or "", encoding="utf-8"
    )
    (out_prefix.parent / f"{out_prefix.name}.whisper-cli.stdout.log").write_text(
        proc.stdout or "", encoding="utf-8"
    )
    if proc.returncode != 0:
        raise RuntimeError(f"whisper-cli exit {proc.returncode}: {(proc.stderr or '')[-2000:]}")
    json_path = Path(str(out_prefix) + ".json")
    if not json_path.is_file():
        # some builds append differently
        candidates = list(out_prefix.parent.glob(out_prefix.name + "*.json"))
        if not candidates:
            raise FileNotFoundError(f"missing JSON next to {out_prefix}")
        json_path = candidates[0]
    parsed = parse_whisper_json(json_path)
    return parsed, wall


def load_prior_paraformer(path: Path) -> dict | None:
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    # normalize shape from prior spike (TranscriptionResult-like + _spike_* fields)
    segs = data.get("segments") or []
    text = (
        data.get("text")
        or data.get("full_text")
        or "".join((s.get("text") or "") for s in segs)
    )
    wall = data.get("wall_sec")
    if wall is None:
        wall = data.get("_spike_wall_sec")
    return {
        "run_id": "paraformer_product_prior_2026-07-28",
        "source": str(path),
        "segment_count": int(data.get("segment_count") or len(segs)),
        "segmentation_mode": data.get("segmentation_mode") or data.get("mode"),
        "wall_sec": wall,
        "text": text,
        "segments": segs,
        "notes": "reused prior product-path spike; not re-run this session",
    }


def score_row(
    *,
    run_id: str,
    duration_sec: float,
    wall_sec: float | None,
    segment_count: int,
    text: str,
    segments: list,
    ref: str,
    extra: dict | None = None,
) -> dict:
    whole = is_whole_track(segments, duration_sec) if segments else False
    row = {
        "run_id": run_id,
        "duration_sec": round(duration_sec, 3),
        "wall_sec": None if wall_sec is None else round(wall_sec, 3),
        "rtfx": None if wall_sec in (None, 0) else round(rtfx(duration_sec, wall_sec), 3),
        "segment_count": segment_count,
        "whole_track": whole,
        "punct_density": _punct_density(text),
        "cer": None,
        "content_cer": None,
        "g1_segments_ok": segment_count >= 1 and not whole,
        "g2_long_segments_ok": segment_count >= 10 and not whole,
        "text_preview": text[:240],
    }
    if ref.strip():
        row["cer"] = round(cer_chars(ref, text), 4)
        row["content_cer"] = round(content_cer_chars(ref, text), 4)
    if extra:
        row.update(extra)
    return row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--short-only", action="store_true")
    ap.add_argument("--long-only", action="store_true")
    ap.add_argument("--skip-paraformer-reuse", action="store_true")
    ap.add_argument("--threads", type=int, default=max(4, (os.cpu_count() or 8) // 2))
    ap.add_argument("--language", default="zh")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--audio", type=Path, default=DEFAULT_LONG)
    ap.add_argument("--ref", type=Path, default=DEFAULT_LONG_REF)
    ap.add_argument("--whisper-cli", type=Path, default=DEFAULT_WHISPER_CLI)
    ap.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    ap.add_argument("--ffmpeg", type=Path, default=DEFAULT_FFMPEG)
    ap.add_argument(
        "--extra-whisper-args",
        default="-tp 0.0 -mc 64 -et 3.0 -sns",
        help="extra whisper-cli flags (EasyWhisperUI-like anti-hallucination defaults)",
    )
    ap.add_argument("--out-prefix-tag", default="", help="suffix for output filenames")
    args = ap.parse_args()
    extra = [t for t in str(args.extra_whisper_args).split() if t]
    tag = f"_{args.out_prefix_tag}" if args.out_prefix_tag else ""

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    ref = args.ref.read_text(encoding="utf-8") if args.ref.is_file() else ""
    ffmpeg = args.ffmpeg if args.ffmpeg.is_file() else Path("ffmpeg")

    rows: list[dict] = []
    gates: dict[str, bool | None] = {
        "G1_short_segments": None,
        "G2_long_segments": None,
        "G3_content_cer_vs_paraformer": None,
        "G4_wall_le_2x_paraformer": None,
    }

    do_short = not args.long_only
    do_long = not args.short_only

    if do_short:
        short_wav = ensure_wav(args.audio, out / "d3-short-30s.wav", ffmpeg, ss=60.0, t=30.0)
        short_dur = _audio_duration_sec(short_wav, ffmpeg)
        print(f"[short] whisper-cli on {short_wav} ({short_dur:.1f}s) …", flush=True)
        parsed, wall = run_whisper_cli(
            cli=args.whisper_cli,
            model=args.model,
            wav=short_wav,
            out_prefix=out / f"short-whisper_cpp_large_v3{tag}",
            language=args.language,
            threads=args.threads,
            extra_args=extra,
        )
        (out / f"short-whisper_cpp_large_v3{tag}.parsed.json").write_text(
            json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        row = score_row(
            run_id=f"short_whisper_cpp_large_v3{tag or '_baseline'}",
            duration_sec=short_dur,
            wall_sec=wall,
            segment_count=parsed["segment_count"],
            text=parsed["text"],
            segments=parsed["segments"],
            ref="",
            extra={"raw_keys": parsed["raw_keys"], "extra_whisper_args": extra},
        )
        rows.append(row)
        gates["G1_short_segments"] = bool(row["g1_segments_ok"])
        print(
            f"[short] segments={row['segment_count']} whole={row['whole_track']} "
            f"wall={row['wall_sec']}s",
            flush=True,
        )

    para_row = None
    if do_long and not args.skip_paraformer_reuse:
        prior = load_prior_paraformer(PRIOR_PARAFORMER)
        if prior:
            long_dur = _audio_duration_sec(args.audio, ffmpeg)
            para_row = score_row(
                run_id=prior["run_id"],
                duration_sec=long_dur,
                wall_sec=prior.get("wall_sec"),
                segment_count=int(prior["segment_count"]),
                text=prior["text"],
                segments=prior.get("segments") or [],
                ref=ref,
                extra={
                    "segmentation_mode": prior.get("segmentation_mode"),
                    "notes": prior.get("notes"),
                    "source": prior.get("source"),
                },
            )
            rows.append(para_row)
            print(
                f"[long] reused paraformer: segments={para_row['segment_count']} "
                f"content_cer={para_row['content_cer']} wall={para_row['wall_sec']}",
                flush=True,
            )

    if do_long:
        long_wav = ensure_wav(args.audio, out / "d3-long-16k.wav", ffmpeg)
        long_dur = _audio_duration_sec(long_wav, ffmpeg)
        print(f"[long] whisper-cli on {long_wav} ({long_dur:.1f}s) …", flush=True)
        parsed, wall = run_whisper_cli(
            cli=args.whisper_cli,
            model=args.model,
            wav=long_wav,
            out_prefix=out / f"long-whisper_cpp_large_v3{tag}",
            language=args.language,
            threads=args.threads,
            extra_args=extra,
        )
        (out / f"long-whisper_cpp_large_v3{tag}.parsed.json").write_text(
            json.dumps(
                {
                    "segment_count": parsed["segment_count"],
                    "text": parsed["text"],
                    "segments": parsed["segments"],
                    "raw_keys": parsed["raw_keys"],
                    "extra_whisper_args": extra,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        wrow = score_row(
            run_id=f"long_whisper_cpp_large_v3{tag or '_baseline'}",
            duration_sec=long_dur,
            wall_sec=wall,
            segment_count=parsed["segment_count"],
            text=parsed["text"],
            segments=parsed["segments"],
            ref=ref,
            extra={"raw_keys": parsed["raw_keys"], "extra_whisper_args": extra},
        )
        rows.append(wrow)
        gates["G2_long_segments"] = bool(wrow["g2_long_segments_ok"])
        if para_row and para_row.get("content_cer") is not None and wrow.get("content_cer") is not None:
            # G3: whisper content_cer <= paraformer * 1.1
            gates["G3_content_cer_vs_paraformer"] = wrow["content_cer"] <= para_row["content_cer"] * 1.1
        para_wall = para_row.get("wall_sec") if para_row else None
        if para_wall is None and para_row:
            para_wall = 41.5  # known prior product-path wall on same D3 gold
            para_row["wall_sec"] = para_wall
            para_row["rtfx"] = round(rtfx(long_dur, para_wall), 3)
            para_row["notes"] = (para_row.get("notes") or "") + "; wall_sec backfilled=41.5"
        if para_row and para_wall and wrow.get("wall_sec"):
            gates["G4_wall_le_2x_paraformer"] = wrow["wall_sec"] <= float(para_wall) * 2.0
        print(
            f"[long] segments={wrow['segment_count']} whole={wrow['whole_track']} "
            f"content_cer={wrow['content_cer']} wall={wrow['wall_sec']}s rtfx={wrow['rtfx']}",
            flush=True,
        )

    # verdict
    g2 = gates.get("G2_long_segments")
    long_rows = [r for r in rows if str(r.get("run_id", "")).startswith("long_whisper")]
    hyp_cer = long_rows[-1].get("content_cer") if long_rows else None
    hallucinated = hyp_cer is not None and hyp_cer >= 0.5
    if g2 is False or hallucinated:
        verdict = "No-go"
    elif g2 is True and gates.get("G3_content_cer_vs_paraformer") and gates.get("G4_wall_le_2x_paraformer"):
        verdict = "Go-candidate-optional-engine"
    elif g2 is True:
        verdict = "Defer"
    else:
        verdict = "Incomplete"
    gates["hallucination_or_cer_ge_0_5"] = hallucinated

    summary = {
        "date": time.strftime("%Y-%m-%d"),
        "engine": "whisper.cpp ggml-large-v3",
        "whisper_cli": str(args.whisper_cli),
        "model": str(args.model),
        "audio": str(args.audio),
        "gates": gates,
        "verdict": verdict,
        "rows": rows,
        "notes": [
            "Prior FunASR-embedded Whisper No-go does not apply to this stack.",
            "Paraformer baseline reused from 2026-07-28 product-path spike unless re-run.",
            "No catalog / default-engine changes authorized by this script.",
        ],
    }
    summary_path = out / "compare-summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"verdict": verdict, "gates": gates, "summary": str(summary_path)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
