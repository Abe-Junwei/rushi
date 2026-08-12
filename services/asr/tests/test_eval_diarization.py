from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).parents[3] / "scripts" / "eval-diarization.py"
SPEC = importlib.util.spec_from_file_location("eval_diarization", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_optimal_label_permutation_scores_zero() -> None:
    ref = [(0.0, 2.0, "alice"), (2.0, 4.0, "bob")]
    hyp = [(0.0, 2.0, "spk-9"), (2.0, 4.0, "spk-2")]
    result = MODULE.score(ref, hyp, collar=0.0, frame=0.1)
    assert result["der"] == 0.0
    assert result["speaker_coverage"] == 1.0


def test_reports_miss_false_alarm_and_confusion() -> None:
    ref = [(0.0, 1.0, "a"), (1.0, 2.0, "b")]
    hyp = [(0.0, 0.5, "x"), (1.0, 2.5, "x")]
    result = MODULE.score(ref, hyp, collar=0.0, frame=0.1)
    assert result["der"] > 0.0
    assert result["miss"] > 0.0
    assert result["false_alarm"] > 0.0
