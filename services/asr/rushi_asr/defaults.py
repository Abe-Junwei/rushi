"""Product defaults (single SKU; see docs/architecture/asr-sidecar-funasr-policy.md)."""

from __future__ import annotations

import os

# ModelScope hub id used when RUSHI_FUNASR_MODEL is unset (runtime download into RUSHI_MODELS_ROOT).
DEFAULT_FUNASR_MODEL_ID = (
    "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
)
DEFAULT_FUNASR_VAD_MODEL_ID = "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"
DEFAULT_FUNASR_PUNC_MODEL_ID = "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"
DEFAULT_FUNASR_SPK_MODEL_ID = "iic/speech_campplus_sv_zh-cn_16k-common"

# Run-level diarization clustering guards. Starting points from
# docs/execution/specs/r3g-d-diarization-clustering-rework-plan.md §1.3; they must be
# recalibrated on real audio (DC3) rather than tuned against synthetic samples.
DEFAULT_SPK_MIN_OBSERVATION_SPEECH_SEC = 1.5
DEFAULT_SPK_MIN_SPEAKER_SPEECH_SEC = 8.0
DEFAULT_SPK_MAX_SPEAKERS = 10
DEFAULT_SPK_ABSORB_FLOOR = 0.20
# Lower bound for the adaptive speaker floor so short recordings keep their speakers.
SPK_ADAPTIVE_FLOOR_MIN_SEC = 2.0
SPK_ADAPTIVE_FLOOR_SPEECH_RATIO = 0.1


def effective_funasr_model_id() -> str:
    v = os.environ.get("RUSHI_FUNASR_MODEL", "").strip()
    return v or DEFAULT_FUNASR_MODEL_ID


def effective_funasr_vad_model_id() -> str | None:
    v = os.environ.get("RUSHI_FUNASR_VAD_MODEL", "fsmn-vad").strip()
    if not v:
        return None
    if v == "fsmn-vad":
        return DEFAULT_FUNASR_VAD_MODEL_ID
    return v


def funasr_model_explicit_from_env() -> bool:
    return bool(os.environ.get("RUSHI_FUNASR_MODEL", "").strip())


def _env_float(name: str, fallback: float) -> float:
    try:
        return float(os.environ.get(name, fallback))
    except ValueError:
        return fallback


def _env_int(name: str, fallback: int) -> int:
    try:
        return int(os.environ.get(name, fallback))
    except ValueError:
        return fallback


def effective_spk_min_observation_speech_sec() -> float:
    """Below this, a window-local speaker is too short to seed its own cluster."""
    return max(
        0.0,
        _env_float(
            "RUSHI_FUNASR_SPK_MIN_OBS_SPEECH_SEC", DEFAULT_SPK_MIN_OBSERVATION_SPEECH_SEC
        ),
    )


def effective_spk_min_speaker_speech_sec() -> float:
    """Configured floor for keeping a cluster as its own speaker (before adaptation)."""
    return max(
        0.0,
        _env_float(
            "RUSHI_FUNASR_SPK_MIN_SPEAKER_SPEECH_SEC", DEFAULT_SPK_MIN_SPEAKER_SPEECH_SEC
        ),
    )


def effective_spk_max_speakers() -> int:
    """Safety cap on run-level speaker count; exceeding it clamps and warns."""
    return max(1, _env_int("RUSHI_FUNASR_SPK_MAX_SPEAKERS", DEFAULT_SPK_MAX_SPEAKERS))


def effective_spk_absorb_floor() -> float:
    """Similarity below which absorbing a small cluster is recorded as suspicious."""
    return _env_float("RUSHI_FUNASR_SPK_ABSORB_FLOOR", DEFAULT_SPK_ABSORB_FLOOR)


def effective_funasr_spk_model_id(*, requested: bool | None = None) -> str | None:
    """Optional CAM++ model id.

    ``requested=True`` is a per-job opt-in and uses the product default when no
    profile value exists. ``requested=False`` always disables diarization.
    ``None`` reflects the persisted/profile environment only.
    """
    if requested is False:
        return None
    raw = os.environ.get("RUSHI_FUNASR_SPK_MODEL", "").strip()
    if requested is True:
        return DEFAULT_FUNASR_SPK_MODEL_ID if raw in ("", "cam++") else raw
    if not raw:
        return None
    return DEFAULT_FUNASR_SPK_MODEL_ID if raw == "cam++" else raw
