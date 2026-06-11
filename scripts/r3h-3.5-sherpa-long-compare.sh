#!/usr/bin/env bash
# R3h-3.5 — Sherpa Paraformer long-audio spike vs FunASR baseline (when sidecar up).
# Usage:
#   export SHERPA_PARAFORMER_MODEL_DIR=...
#   bash scripts/r3h-3.5-sherpa-long-compare.sh              # default 13min clip
#   bash scripts/r3h-3.5-sherpa-long-compare.sh --duration 30 # quick smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPIKE_MANIFEST="$ROOT/apps/desktop/src-tauri/spike/sherpa_paraformer/Cargo.toml"
MODEL_DIR="${SHERPA_PARAFORMER_MODEL_DIR:-}"
VAD_MODEL="${SHERPA_SILERO_VAD_MODEL:-}"
PIPELINE="${SHERPA_PIPELINE:-p0}"
PROVIDER="${SHERPA_PROVIDER:-cpu}"
BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"

LONG_SRC="${RUSHI_R3T_LONG_AUDIO:-$ROOT/fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3}"
DURATION_SEC="${RUSHI_SHERPA_CLIP_SEC:-780}"
SKIP_FUNASR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --duration)
      DURATION_SEC="$2"
      shift 2
      ;;
    --skip-funasr)
      SKIP_FUNASR=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$MODEL_DIR" || ! -d "$MODEL_DIR" ]]; then
  echo "Set SHERPA_PARAFORMER_MODEL_DIR to extracted sherpa paraformer model directory." >&2
  exit 1
fi
if [[ ! -f "$LONG_SRC" ]]; then
  echo "Long audio not found: $LONG_SRC" >&2
  exit 1
fi

OUT_DIR="${SPIKE_OUTPUT_DIR:-$ROOT/docs/execution/spike-output/sherpa-paraformer-$(date +%Y-%m-%d)}"
mkdir -p "$OUT_DIR"
CLIP_WAV="$OUT_DIR/long-${DURATION_SEC}s-16k.wav"
SHERPA_JSON="$OUT_DIR/sherpa-${PIPELINE}-${DURATION_SEC}s-${PROVIDER}.json"
FUNASR_JSON="$OUT_DIR/funasr-paraformer-${DURATION_SEC}s.json"
RESULTS_MD="$OUT_DIR/results-${PIPELINE}-${DURATION_SEC}s.md"
QUANT_JSON="$OUT_DIR/quant-compare-${PIPELINE}-${DURATION_SEC}s.json"

if [[ "$PIPELINE" == "p2" && ( -z "$VAD_MODEL" || ! -f "$VAD_MODEL" ) ]]; then
  echo "P2 requires SHERPA_SILERO_VAD_MODEL pointing to silero_vad.onnx" >&2
  echo "Run: bash scripts/r3h-3.5-download-sherpa-p2.sh" >&2
  exit 1
fi

echo "== R3h-3.5 Sherpa long compare =="
echo "source: $LONG_SRC"
echo "clip: ${DURATION_SEC}s → $CLIP_WAV"
echo "pipeline: $PIPELINE"
echo "model: $MODEL_DIR"
echo "provider: $PROVIDER"
[[ "$PIPELINE" == "p2" ]] && echo "vad: $VAD_MODEL"

ffmpeg -y -hide_banner -loglevel error -i "$LONG_SRC" -t "$DURATION_SEC" -ac 1 -ar 16000 "$CLIP_WAV"

SPIKE_ARGS=(--wav "$CLIP_WAV" --model-dir "$MODEL_DIR" --provider "$PROVIDER" --pipeline "$PIPELINE" --output "$SHERPA_JSON")
if [[ "$PIPELINE" == "p2" ]]; then
  SPIKE_ARGS+=(--vad-model "$VAD_MODEL")
fi
cargo run --quiet --manifest-path "$SPIKE_MANIFEST" -- "${SPIKE_ARGS[@]}"

FUNASR_STATUS="skipped"
FUNASR_WALL_MS=""
if [[ "$SKIP_FUNASR" -eq 0 ]] && curl -sf --max-time 3 "$BASE/health" >/dev/null 2>&1; then
  echo "== FunASR baseline ($BASE) =="
  FUNASR_START_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
  HOTWORDS="${RUSHI_SHERPA_COMPARE_HOTWORDS:-}"
  CURL_ARGS=(-sf --max-time "${RUSHI_TRANSCRIBE_TIMEOUT_SEC:-7200}" -F "file=@${CLIP_WAV};filename=clip.wav")
  if [[ -n "$HOTWORDS" ]]; then
    CURL_ARGS+=(-F "hotwords=${HOTWORDS}")
    echo "hotwords: $HOTWORDS"
  fi
  curl "${CURL_ARGS[@]}" "$BASE/v1/transcribe" -o "$FUNASR_JSON"
  FUNASR_END_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
  FUNASR_WALL_MS="$((FUNASR_END_MS - FUNASR_START_MS))"
  FUNASR_STATUS="ok"
  echo "funasr wall_ms: $FUNASR_WALL_MS"
else
  echo "SKIP: FunASR sidecar not at $BASE (start with npm run asr:dev for baseline)"
fi

python3 - "$ROOT" "$SHERPA_JSON" "$FUNASR_JSON" "$FUNASR_STATUS" "$FUNASR_WALL_MS" "$RESULTS_MD" "$QUANT_JSON" "$DURATION_SEC" <<'PY'
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1])
sherpa_path, funasr_path, funasr_status, funasr_wall_ms, results_md, quant_json, duration = sys.argv[2:9]

spec = importlib.util.spec_from_file_location(
    "rushi_eval_metrics", root / "services/asr/rushi_asr/eval_metrics.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
cer_chars = mod.cer_chars
term_hit_rate = mod.term_hit_rate
rtfx = mod.rtfx

s = json.loads(Path(sherpa_path).read_text(encoding="utf-8"))
sherpa_text = (s.get("text") or "").strip()
pipeline = s.get("pipeline") or "p0"
sherpa_segs = s.get("vad_segment_count") or s.get("pseudo_segment_count") or 0
lines = [
    f"# Sherpa spike — {pipeline} — {duration}s clip",
    "",
    f"_Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_",
    "",
    f"## Sherpa {pipeline.upper()}",
    "",
    f"| metric | value |",
    f"|--------|-------|",
    f"| pipeline | `{pipeline}` |",
    f"| engine | `{s.get('engine')}` |",
    f"| model_id | `{s['model_id']}` |",
    f"| provider | `{s['provider']}` |",
    f"| duration_sec | {s['duration_sec']:.2f} |",
    f"| decode_ms | {s['decode_ms']} |",
    f"| rtf | {s['rtf']:.4f} |",
    f"| char_count | {s['char_count']} |",
    f"| segment_count | {sherpa_segs} |",
    "",
]
if pipeline == "p2":
    lines.append("> P2: Silero VAD + per-segment Paraformer-large; still **no punctuation**.")
else:
    lines.extend([
        f"| token_count | {s.get('token_count', 0)} |",
        f"| timestamp_count | {s.get('timestamp_count', 0)} |",
        "",
        "> P0: whole-track; `pseudo_segment_count` from token timestamp gaps.",
        "",
    ])

quant = {
    "schema_version": "r3h-3.5-quant-compare-v2",
    "generated_utc": datetime.now(timezone.utc).isoformat(),
    "clip_duration_sec": float(duration),
    "sherpa": {
        "pipeline": pipeline,
        "engine": s.get("engine"),
        "model_id": s.get("model_id"),
        "vad_model": s.get("vad_model"),
        "provider": s.get("provider"),
        "duration_sec": s.get("duration_sec"),
        "decode_ms": s.get("decode_ms"),
        "rtf": s.get("rtf"),
        "rtfx": rtfx(s.get("duration_sec"), (s.get("decode_ms") or 0) / 1000.0),
        "char_count": s.get("char_count"),
        "segment_count": sherpa_segs,
        "pseudo_segment_count": s.get("pseudo_segment_count"),
        "vad_segment_count": s.get("vad_segment_count"),
        "timestamp_count": s.get("timestamp_count"),
        "term_hit_制控": term_hit_rate(["制控"], sherpa_text),
    },
    "funasr": None,
    "cross": None,
}

if funasr_status == "ok" and Path(funasr_path).is_file():
    f = json.loads(Path(funasr_path).read_text(encoding="utf-8"))
    segs = f.get("segments") or []
    hyp = (f.get("hypothesis") or "").strip()
    if not hyp:
        hyp = "".join((seg.get("text") or "") for seg in segs).strip()
    warn = f.get("warnings") or []
    wall_ms = int(funasr_wall_ms) if funasr_wall_ms.isdigit() else None
    wall_sec = wall_ms / 1000.0 if wall_ms else None
    dur = f.get("duration_sec") or s.get("duration_sec")
    funasr_rtf = (wall_sec / dur) if wall_sec and dur else None
    cer_s_vs_f = cer_chars(hyp, sherpa_text)
    cer_f_vs_s = cer_chars(sherpa_text, hyp)
    quant["funasr"] = {
        "engine": f.get("engine"),
        "funasr_model_id": f.get("funasr_model_id"),
        "segmentation_mode": f.get("segmentation_mode"),
        "duration_sec": dur,
        "wall_ms": wall_ms,
        "rtf": funasr_rtf,
        "rtfx": rtfx(dur, wall_sec),
        "segment_count": len(segs),
        "char_count": len(hyp),
        "term_hit_制控": term_hit_rate(["制控"], hyp),
        "warnings": warn[:8],
        "error": f.get("error"),
    }
    quant["cross"] = {
        "cer_sherpa_vs_funasr_ref": cer_s_vs_f,
        "cer_funasr_vs_sherpa_ref": cer_f_vs_s,
        "char_count_ratio_sherpa_over_funasr": (
            s.get("char_count", 0) / len(hyp) if hyp else None
        ),
        "segment_ratio_funasr_over_sherpa": (
            len(segs) / sherpa_segs if sherpa_segs else None
        ),
    }
    lines += [
        "## FunASR Paraformer baseline",
        "",
        f"| metric | value |",
        f"|--------|-------|",
        f"| segments | {len(segs)} |",
        f"| engine | `{f.get('engine')}` |",
        f"| model | `{f.get('funasr_model_id')}` |",
        f"| segmentation_mode | `{f.get('segmentation_mode')}` |",
        f"| duration_sec | {dur} |",
        f"| wall_ms | {wall_ms} |",
        f"| rtf | {funasr_rtf:.4f} |" if funasr_rtf is not None else "| rtf | — |",
        f"| char_count | {len(hyp)} |",
        f"| term_hit 制控 | {quant['funasr']['term_hit_制控']:.2f} |",
        f"| warnings | {warn[:5]} |",
        "",
        "## Quantitative cross (FunASR hypothesis as reference)",
        "",
        f"| metric | value |",
        f"|--------|-------|",
        f"| cer (sherpa vs funasr) | {cer_s_vs_f:.4f} |",
        f"| cer (funasr vs sherpa) | {cer_f_vs_s:.4f} |",
        f"| char_count ratio (sherpa/funasr) | {quant['cross']['char_count_ratio_sherpa_over_funasr']:.3f} |"
        if quant["cross"]["char_count_ratio_sherpa_over_funasr"] is not None
        else "| char_count ratio | — |",
        "",
        "## Gap notes",
        "",
        "| capability | FunASR | Sherpa P0 |",
        "|------------|--------|-----------|",
        f"| VAD / sentence segments | {len(segs)} | {sherpa_segs} |",
        "| punctuation | ct-punc | none (raw ASR) |",
        f"| timestamps | sentence_timestamp | {s['timestamp_count']} token-level |",
        f"| term 制控 | {quant['funasr']['term_hit_制控']:.0%} | {quant['sherpa']['term_hit_制控']:.0%} |",
        "",
    ]
else:
    lines += [
        "## FunASR baseline",
        "",
        "_Sidecar offline — recorded FunASR refs: R3t-A ~28 segs / 13min project audio; eval 制控 ~197 segs / ~21min._",
        "",
    ]

preview = (s.get("text") or "")[:240]
lines += [
    "## Sherpa text preview",
    "",
    f"```\n{preview}{'…' if len(s.get('text') or '') > 240 else ''}\n```",
    "",
]

Path(results_md).write_text("\n".join(lines), encoding="utf-8")
Path(quant_json).write_text(json.dumps(quant, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {results_md}")
print(f"wrote {quant_json}")
print(f"  sherpa {pipeline} rtf={s['rtf']:.4f} segments={sherpa_segs} chars={s['char_count']}")
if quant.get("cross"):
    c = quant["cross"]
    print(f"  cer(sherpa|funasr)={c['cer_sherpa_vs_funasr_ref']:.4f} funasr_segs={quant['funasr']['segment_count']}")
PY

echo "OK: $RESULTS_MD"
echo "OK: $QUANT_JSON"
