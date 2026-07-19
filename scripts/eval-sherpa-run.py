#!/usr/bin/env python3
"""Run the hardened Sherpa Qwen3 spike against one manifest gold item."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "asr"))

from rushi_asr.eval_metrics import (  # noqa: E402
    cer_chars,
    content_cer_chars,
    rtfx,
    term_hit_rate,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "fixtures/eval/eval_manifest.v1.json")
    parser.add_argument("--item", default="d3-tang32-zhikong-gaijiang")
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=ROOT / "fixtures/sherpa-qwen3-asr-0.6B-int8-2026-03-25",
    )
    parser.add_argument("--vad-model", type=Path, default=ROOT / "fixtures/sherpa-vad/silero_vad.onnx")
    parser.add_argument(
        "--punct-model",
        type=Path,
        default=ROOT / "fixtures/sherpa-punctuation-zh-en/model.int8.onnx",
    )
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument(
        "--hotwords-mode",
        choices=("manifest", "off"),
        default="manifest",
        help="Use manifest hotwords, or disable hotwords for a clean model baseline.",
    )
    parser.add_argument(
        "--punctuation-mode",
        choices=("on", "off"),
        default="on",
        help="Run the external punctuation model, or keep Qwen3 raw punctuation only.",
    )
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def load_item(manifest_path: Path, item_id: str) -> tuple[dict, Path, str]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    item = next((row for row in manifest.get("items", []) if row.get("id") == item_id), None)
    if item is None:
        raise SystemExit(f"manifest item not found: {item_id}")
    base = manifest_path.parent
    audio = base / item["audio_relpath"]
    if item.get("reference_relpath"):
        reference = (base / item["reference_relpath"]).read_text(encoding="utf-8")
    else:
        reference = item.get("reference_transcript") or ""
    if not audio.is_file() or not reference.strip():
        raise SystemExit("selected item requires an existing audio file and non-empty gold reference")
    return item, audio, reference


def require_path(path: Path, label: str) -> None:
    if not path.exists():
        raise SystemExit(f"{label} missing: {path}")


def main() -> int:
    args = parse_args()
    item, audio, reference = load_item(args.manifest, args.item)
    require_path(args.model_dir / "conv_frontend.onnx", "Qwen3 model")
    require_path(args.vad_model, "Silero VAD model")
    if args.punctuation_mode == "on":
        require_path(args.punct_model, "punctuation model")

    mode_suffix = f"hotwords-{args.hotwords_mode}_punct-{args.punctuation_mode}"
    output = args.output or (
        ROOT
        / "docs/execution/spike-output"
        / f"qwen3-a-{datetime.now().date().isoformat()}"
        / f"{args.item}.{mode_suffix}.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="rushi_sherpa_eval_") as tmp:
        wav = Path(tmp) / "input-16k.wav"
        spike_json = Path(tmp) / "spike.json"
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(audio), "-ac", "1", "-ar", "16000", str(wav)],
            check=True,
        )
        command = [
            "cargo", "run", "--quiet", "--manifest-path",
            str(ROOT / "apps/desktop/src-tauri/spike/sherpa_qwen3/Cargo.toml"), "--",
            "--wav", str(wav), "--model-dir", str(args.model_dir),
            "--vad-model", str(args.vad_model),
            "--pipeline", "vad", "--threads", str(args.threads),
            "--output", str(spike_json),
        ]
        if args.punctuation_mode == "on":
            command.extend(["--punct-model", str(args.punct_model)])
        hotwords = (item.get("hotwords") or "").strip() if args.hotwords_mode == "manifest" else ""
        if hotwords:
            command.extend(["--hotwords", hotwords])
        started = time.monotonic()
        subprocess.run(command, check=True, cwd=ROOT)
        wall_sec = time.monotonic() - started
        spike = json.loads(spike_json.read_text(encoding="utf-8"))

    raw_text = spike.get("raw_text") or ""
    punctuated_text = spike.get("text") or raw_text
    terms = [str(term) for term in item.get("expected_terms", [])]
    term_hits = {term: term in raw_text for term in terms}
    segment_count = int(spike.get("vad_segment_count") or 0)
    empty_result_count = int(spike.get("empty_result_segment_count") or 0)
    token_limit_count = int(spike.get("token_limit_segment_count") or 0)
    report = {
        "schema_version": "r3s-a-sherpa-eval-v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "item_id": args.item,
        "audio_path": str(audio.resolve()),
        "reference_path": str((args.manifest.parent / item["reference_relpath"]).resolve())
        if item.get("reference_relpath") else None,
        "engine": spike.get("engine"),
        "model_id": spike.get("model_id"),
        "hotwords_mode": args.hotwords_mode,
        "punctuation_mode": args.punctuation_mode,
        "hotwords": hotwords,
        "reference_text": reference,
        "raw_text": raw_text,
        "punctuated_text": punctuated_text,
        "segments": spike.get("segments") or [],
        "content_cer": content_cer_chars(reference, raw_text),
        "cer_chars_with_punctuation": cer_chars(reference, punctuated_text),
        "term_hit_rate": term_hit_rate(terms, raw_text),
        "term_hits": term_hits,
        "duration_sec": spike.get("duration_sec"),
        "decode_ms": spike.get("decode_ms"),
        "wall_sec": round(wall_sec, 3),
        "rtfx_decode": rtfx(spike.get("duration_sec"), (spike.get("decode_ms") or 0) / 1000),
        "rtfx_wall": rtfx(spike.get("duration_sec"), wall_sec),
        "segment_count": segment_count,
        "empty_result_segment_count": empty_result_count,
        "empty_result_segment_ratio": empty_result_count / segment_count if segment_count else 0.0,
        "vad_audio_coverage_ratio": spike.get("vad_audio_coverage_ratio"),
        "token_limit_segment_count": token_limit_count,
        "token_limit_segment_ratio": token_limit_count / segment_count if segment_count else 0.0,
        "punctuation_ms": spike.get("punctuation_ms"),
        "config": {
            key: spike.get(key)
            for key in (
                "max_new_tokens", "vad_threshold", "vad_min_speech_sec",
                "vad_min_silence_sec", "vad_max_speech_sec", "vad_padding_sec",
            )
        },
    }
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    raw_output = output.with_suffix(".raw.txt")
    punctuated_output = output.with_suffix(".punctuated.txt")
    raw_output.write_text(raw_text, encoding="utf-8")
    punctuated_output.write_text(punctuated_text, encoding="utf-8")
    summary = {
        "item_id": args.item,
        "hotwords_mode": args.hotwords_mode,
        "punctuation_mode": args.punctuation_mode,
        "content_cer": report["content_cer"],
        "cer_chars_with_punctuation": report["cer_chars_with_punctuation"],
        "term_hit_rate": report["term_hit_rate"],
        "rtfx_wall": report["rtfx_wall"],
        "segment_count": report["segment_count"],
        "empty_result_segment_count": report["empty_result_segment_count"],
        "json": str(output),
        "raw_txt": str(raw_output),
        "punctuated_txt": str(punctuated_output),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
