#!/usr/bin/env bash
# R3g-B — FunASR vs Sherpa on the same Qwen3-ASR-0.6B SKU (spike, non-product).
#
# FunASR path: PyTorch hub id Qwen/Qwen3-ASR-0.6B (your ModelScope cache).
# Sherpa path: sherpa-onnx-qwen3-asr-0.6B-int8 ONNX pack (separate download).
#
# Usage:
#   bash scripts/r3g-b-download-sherpa-qwen3-onnx.sh
#   bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 30
#   bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 780 --pipeline vad
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPIKE_MANIFEST="$ROOT/apps/desktop/src-tauri/spike/sherpa_qwen3/Cargo.toml"
ASR_VENV="$ROOT/services/asr/.venv/bin/python"
QWEN_FUNASR="Qwen/Qwen3-ASR-0.6B"
QWEN_ALIGNER="${RUSHI_FUNASR_FORCED_ALIGNER:-}"

MODEL_DIR="${SHERPA_QWEN3_MODEL_DIR:-$ROOT/fixtures/sherpa-qwen3-asr-0.6B}"
VAD_MODEL="${SHERPA_SILERO_VAD_MODEL:-$ROOT/fixtures/sherpa-vad/silero_vad.onnx}"
PIPELINE="${SHERPA_QWEN3_PIPELINE:-whole}"
PROVIDER="${SHERPA_PROVIDER:-cpu}"
LONG_SRC="${RUSHI_R3T_LONG_AUDIO:-$ROOT/fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3}"
DURATION_SEC="${RUSHI_QWEN3_CLIP_SEC:-30}"
SKIP_FUNASR=0
SKIP_SHERPA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --duration)
      DURATION_SEC="$2"
      shift 2
      ;;
    --pipeline)
      PIPELINE="$2"
      shift 2
      ;;
    --skip-funasr)
      SKIP_FUNASR=1
      shift
      ;;
    --skip-sherpa)
      SKIP_SHERPA=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$LONG_SRC" ]]; then
  echo "Long audio not found: $LONG_SRC" >&2
  exit 1
fi

OUT_DIR="${SPIKE_OUTPUT_DIR:-$ROOT/docs/execution/spike-output/qwen3-0.6b-$(date +%Y-%m-%d)}"
mkdir -p "$OUT_DIR"
CLIP_WAV="$OUT_DIR/clip-${DURATION_SEC}s-16k.wav"
SHERPA_JSON="$OUT_DIR/sherpa-qwen3-${PIPELINE}-${DURATION_SEC}s.json"
FUNASR_JSON="$OUT_DIR/funasr-qwen3-${DURATION_SEC}s.json"
QUANT_JSON="$OUT_DIR/quant-compare-qwen3-0.6b-${PIPELINE}-${DURATION_SEC}s.json"
RESULTS_MD="$OUT_DIR/results-qwen3-0.6b-${PIPELINE}-${DURATION_SEC}s.md"

echo "== R3g-B Qwen3-0.6B FunASR vs Sherpa =="
echo "source: $LONG_SRC"
echo "clip: ${DURATION_SEC}s → $CLIP_WAV"
echo "funasr model: $QWEN_FUNASR"
echo "sherpa model_dir: $MODEL_DIR"
echo "sherpa pipeline: $PIPELINE"
[[ -n "$QWEN_ALIGNER" ]] && echo "forced_aligner: $QWEN_ALIGNER"

ffmpeg -y -hide_banner -loglevel error -i "$LONG_SRC" -t "$DURATION_SEC" -ac 1 -ar 16000 "$CLIP_WAV"

if [[ "$SKIP_SHERPA" -eq 0 ]]; then
  if [[ ! -f "$MODEL_DIR/conv_frontend.onnx" ]]; then
    echo "Sherpa ONNX missing. Run: bash scripts/r3g-b-download-sherpa-qwen3-onnx.sh" >&2
    exit 1
  fi
  if [[ "$PIPELINE" == "vad" && ! -f "$VAD_MODEL" ]]; then
    echo "VAD pipeline needs silero: bash scripts/r3h-3.5-download-sherpa-p2.sh (VAD only)" >&2
    exit 1
  fi
  SPIKE_ARGS=(--wav "$CLIP_WAV" --model-dir "$MODEL_DIR" --provider "$PROVIDER" --pipeline "$PIPELINE" --output "$SHERPA_JSON")
  if [[ "$PIPELINE" == "vad" ]]; then
    SPIKE_ARGS+=(--vad-model "$VAD_MODEL")
  fi
  HOTWORDS="${RUSHI_QWEN3_COMPARE_HOTWORDS:-}"
  if [[ -n "$HOTWORDS" ]]; then
    SPIKE_ARGS+=(--hotwords "$HOTWORDS")
  fi
  cargo run --quiet --manifest-path "$SPIKE_MANIFEST" -- "${SPIKE_ARGS[@]}"
else
  echo "SKIP: Sherpa spike"
fi

FUNASR_STATUS="skipped"
FUNASR_WALL_MS=""
if [[ "$SKIP_FUNASR" -eq 0 ]]; then
  echo "== FunASR direct engine ($QWEN_FUNASR) =="
  if [[ ! -x "$ASR_VENV" ]]; then
    echo "FAIL: $ASR_VENV not found; run services/asr venv bootstrap" >&2
    exit 1
  fi
  FUNASR_START_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
  MR="${RUSHI_MODELS_ROOT:-$HOME/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models}"
  RUSHI_MODELS_ROOT="$MR" \
  MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-$MR/modelscope}" \
  RUSHI_FUNASR_MODEL="$QWEN_FUNASR" \
  RUSHI_FUNASR_FORCED_ALIGNER="$QWEN_ALIGNER" \
  HF_HOME="$MR/huggingface" \
  HUGGINGFACE_HUB_CACHE="${HF_HOME}/hub" \
  TRANSFORMERS_OFFLINE=1 \
  SPIKE_CLIP="$CLIP_WAV" \
  SPIKE_OUT="$FUNASR_JSON" \
  "$ASR_VENV" - "$ROOT" <<'PY'
import json
import os
import sys
import tempfile
import time
from pathlib import Path

root = Path(sys.argv[1])
sys.path.insert(0, str(root / "services" / "asr"))

from rushi_asr.engine import transcribe_upload  # noqa: E402

clip = Path(os.environ["SPIKE_CLIP"])
out = Path(os.environ["SPIKE_OUT"])
models_root = Path.home() / "Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models"
if models_root.is_dir():
    os.environ.setdefault("RUSHI_MODELS_ROOT", str(models_root))
    os.environ.setdefault("MODELSCOPE_CACHE", str(models_root / "modelscope"))
    hf_home = models_root / "huggingface"
    if hf_home.is_dir():
        os.environ.setdefault("HF_HOME", str(hf_home))
        os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(hf_home / "hub"))

t0 = time.monotonic()
with tempfile.TemporaryDirectory(prefix="qwen3_compare_") as tmp:
    result = transcribe_upload(clip, Path(tmp), os.environ.get("RUSHI_QWEN3_COMPARE_HOTWORDS"))
elapsed = time.monotonic() - t0
payload = result.model_dump()
payload["_spike_wall_sec"] = round(elapsed, 3)
payload["_spike_model_id"] = os.environ.get("RUSHI_FUNASR_MODEL")
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {out} wall_sec={payload['_spike_wall_sec']}")
PY
  FUNASR_END_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
  FUNASR_WALL_MS="$((FUNASR_END_MS - FUNASR_START_MS))"
  FUNASR_STATUS="ok"
fi

python3 - "$ROOT" "$SHERPA_JSON" "$FUNASR_JSON" "$FUNASR_STATUS" "$FUNASR_WALL_MS" "$RESULTS_MD" "$QUANT_JSON" "$DURATION_SEC" "$PIPELINE" "$QWEN_FUNASR" <<'PY'
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1])
sherpa_path, funasr_path, funasr_status, funasr_wall_ms, results_md, quant_json, duration, pipeline, funasr_model = sys.argv[2:11]

spec = importlib.util.spec_from_file_location(
    "rushi_eval_metrics", root / "services/asr/rushi_asr/eval_metrics.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
cer_chars = mod.cer_chars
term_hit_rate = mod.term_hit_rate
rtfx = mod.rtfx

quant = {
    "schema_version": "r3g-b-qwen3-compare-v1",
    "generated_utc": datetime.now(timezone.utc).isoformat(),
    "funasr_model_id": funasr_model,
    "sherpa_model_family": "sherpa-onnx-qwen3-asr-0.6B-int8",
    "clip_duration_sec": float(duration),
    "pipeline": pipeline,
    "sherpa": None,
    "funasr": None,
    "cross": None,
}

lines = [
    f"# Qwen3-ASR-0.6B — FunASR vs Sherpa ({pipeline})",
    "",
    f"_Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_",
    "",
    "> FunASR = PyTorch `Qwen/Qwen3-ASR-0.6B`; Sherpa = ONNX INT8 pack (same SKU family, different runtime).",
    "",
]

if Path(sherpa_path).is_file():
    s = json.loads(Path(sherpa_path).read_text(encoding="utf-8"))
    sherpa_text = (s.get("text") or "").strip()
    sherpa_segs = s.get("vad_segment_count") or 0
    quant["sherpa"] = {
        "engine": s.get("engine"),
        "model_id": s.get("model_id"),
        "pipeline": s.get("pipeline"),
        "duration_sec": s.get("duration_sec"),
        "decode_ms": s.get("decode_ms"),
        "rtf": s.get("rtf"),
        "rtfx": rtfx(s.get("duration_sec"), (s.get("decode_ms") or 0) / 1000.0),
        "char_count": s.get("char_count"),
        "segment_count": sherpa_segs,
        "term_hit_制控": term_hit_rate(["制控"], sherpa_text),
    }
    lines += [
        "## Sherpa ONNX",
        "",
        f"| metric | value |",
        f"|--------|-------|",
        f"| engine | `{s.get('engine')}` |",
        f"| model_id | `{s.get('model_id')}` |",
        f"| pipeline | `{s.get('pipeline')}` |",
        f"| decode_ms | {s.get('decode_ms')} |",
        f"| rtf | {s.get('rtf', 0):.4f} |",
        f"| char_count | {s.get('char_count')} |",
        f"| segments | {sherpa_segs} |",
        "",
    ]
    sherpa_ref = sherpa_text
else:
    sherpa_ref = ""
    lines += ["## Sherpa ONNX", "", "_skipped_", ""]

if funasr_status == "ok" and Path(funasr_path).is_file():
    f = json.loads(Path(funasr_path).read_text(encoding="utf-8"))
    segs = f.get("segments") or []
    hyp = (f.get("hypothesis") or "").strip()
    if not hyp:
        hyp = "".join((seg.get("text") or "") for seg in segs).strip()
    wall_sec = f.get("_spike_wall_sec")
    if wall_sec is None and funasr_wall_ms.isdigit():
        wall_sec = int(funasr_wall_ms) / 1000.0
    dur = f.get("duration_sec") or float(duration)
    funasr_rtf = (wall_sec / dur) if wall_sec and dur else None
    quant["funasr"] = {
        "engine": f.get("engine"),
        "funasr_model_id": f.get("funasr_model_id") or f.get("_spike_model_id"),
        "segmentation_mode": f.get("segmentation_mode"),
        "duration_sec": dur,
        "wall_sec": wall_sec,
        "rtf": funasr_rtf,
        "rtfx": rtfx(dur, wall_sec),
        "segment_count": len(segs),
        "char_count": len(hyp),
        "term_hit_制控": term_hit_rate(["制控"], hyp),
        "warnings": (f.get("warnings") or [])[:8],
    }
    if sherpa_ref and hyp:
        quant["cross"] = {
            "cer_sherpa_vs_funasr_ref": cer_chars(hyp, sherpa_ref),
            "cer_funasr_vs_sherpa_ref": cer_chars(sherpa_ref, hyp),
            "char_count_ratio_sherpa_over_funasr": (
                quant["sherpa"]["char_count"] / len(hyp) if hyp and quant.get("sherpa") else None
            ),
            "segment_ratio_funasr_over_sherpa": (
                len(segs) / quant["sherpa"]["segment_count"]
                if quant.get("sherpa") and quant["sherpa"]["segment_count"]
                else None
            ),
        }
    lines += [
        "## FunASR PyTorch",
        "",
        f"| metric | value |",
        f"|--------|-------|",
        f"| segments | {len(segs)} |",
        f"| engine | `{f.get('engine')}` |",
        f"| wall_sec | {wall_sec} |",
        f"| rtf | {funasr_rtf:.4f} |" if funasr_rtf is not None else "| rtf | — |",
        f"| char_count | {len(hyp)} |",
        f"| warnings | {(f.get('warnings') or [])[:4]} |",
        "",
    ]
    if quant.get("cross"):
        c = quant["cross"]
        lines += [
            "## Cross (FunASR hypothesis as reference)",
            "",
            f"| cer (sherpa vs funasr) | {c['cer_sherpa_vs_funasr_ref']:.4f} |",
            f"| cer (funasr vs sherpa) | {c['cer_funasr_vs_sherpa_ref']:.4f} |",
            "",
        ]
else:
    lines += ["## FunASR PyTorch", "", "_skipped_", ""]

preview = (quant.get("sherpa") or {}).get("char_count")
if Path(sherpa_path).is_file():
    t = json.loads(Path(sherpa_path).read_text(encoding="utf-8")).get("text") or ""
    lines += ["## Sherpa text preview", "", f"```\n{t[:240]}{'…' if len(t) > 240 else ''}\n```", ""]
if funasr_status == "ok" and Path(funasr_path).is_file():
    f = json.loads(Path(funasr_path).read_text(encoding="utf-8"))
    hyp = (f.get("hypothesis") or "").strip() or "".join(
        (seg.get("text") or "") for seg in (f.get("segments") or [])
    )
    lines += ["## FunASR text preview", "", f"```\n{hyp[:240]}{'…' if len(hyp) > 240 else ''}\n```", ""]

Path(results_md).write_text("\n".join(lines), encoding="utf-8")
Path(quant_json).write_text(json.dumps(quant, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {results_md}")
print(f"wrote {quant_json}")
PY

if [[ "$PIPELINE" == "vad" ]]; then
  DUR_ARGS=()
  for d in 30 780; do
    if [[ -f "$OUT_DIR/sherpa-qwen3-vad-${d}s.json" || -f "$OUT_DIR/funasr-qwen3-${d}s.json" ]]; then
      DUR_ARGS+=("$d")
    fi
  done
  if [[ ${#DUR_ARGS[@]} -gt 0 ]]; then
    python3 "$ROOT/scripts/r3g-b-qwen3-segment-compare-md.py" "$OUT_DIR" "${DUR_ARGS[@]}"
    echo "OK: $OUT_DIR/segment-compare-vad-forced-aligner.md"
  fi
fi

echo "OK: $RESULTS_MD"
echo "OK: $QUANT_JSON"
