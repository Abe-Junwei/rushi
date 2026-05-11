#!/usr/bin/env python3
"""
Validate stdin JSON as TranscriptionResult v1 (P0 acceptance).
Exit 0 if OK, 1 otherwise. Optional: require every segment to have non-empty text.

Usage:
  curl -sS -F "file=@x.wav" http://127.0.0.1:8741/v1/transcribe | python3 scripts/validate_p0_transcription_result.py
  P0_REQUIRE_NONEMPTY_TEXT=1 python3 scripts/validate_p0_transcription_result.py < out.json
"""

from __future__ import annotations

import json
import os
import sys


def _fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    require_nonempty = os.environ.get("P0_REQUIRE_NONEMPTY_TEXT", "").strip() in ("1", "true", "yes")
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        _fail(f"invalid json: {e}")

    if data.get("schema_version") != "1":
        _fail("schema_version must be '1'")

    if data.get("error"):
        _fail(f"result.error set: {data['error']}")

    segs = data.get("segments")
    if not isinstance(segs, list) or len(segs) < 1:
        _fail("segments must be a non-empty array")

    for i, s in enumerate(segs):
        if not isinstance(s, dict):
            _fail(f"segment {i} not an object")
        for k in ("start_sec", "end_sec", "text"):
            if k not in s:
                _fail(f"segment {i} missing {k}")
        try:
            st = float(s["start_sec"])
            en = float(s["end_sec"])
        except (TypeError, ValueError):
            _fail(f"segment {i} start_sec/end_sec not numeric")
        if en < st:
            _fail(f"segment {i} end_sec < start_sec")

        conf = s.get("confidence")
        if conf is not None and not isinstance(conf, (int, float)):
            _fail(f"segment {i} confidence must be number or null")

        low = bool(s.get("low_confidence"))
        has_detail = bool(s.get("detail"))
        # P0: 置信度「或」可降级：有数值 confidence，或 low_confidence，或（stub）有 detail 说明
        if conf is None and not low and not has_detail:
            _fail(
                f"segment {i} needs confidence, or low_confidence=true, or detail (degradable confidence)",
            )

        if require_nonempty and not str(s.get("text") or "").strip():
            _fail(f"segment {i} empty text (set FunASR or unset P0_REQUIRE_NONEMPTY_TEXT)")

    if not isinstance(data.get("warnings"), list):
        _fail("warnings must be an array")

    print("OK", len(segs), "segments", "engine=", data.get("engine"), "require_text=", require_nonempty)


if __name__ == "__main__":
    main()
