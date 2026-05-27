"""Curated FunASR hub models for desktop catalog (R3g-A)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rushi_asr.defaults import effective_funasr_model_id


@dataclass(frozen=True)
class LocalAsrCatalogEntry:
    catalog_id: str
    label: str
    hub_model_id: str
    description: str
    disk_hint: str
    recommend_long_audio: bool


LOCAL_ASR_MODEL_CATALOG: tuple[LocalAsrCatalogEntry, ...] = (
    LocalAsrCatalogEntry(
        catalog_id="sensevoice-small",
        label="SenseVoice 轻量（默认）",
        hub_model_id="iic/SenseVoiceSmall",
        description="速度快、占用较低；长音频可能只有整轨单语段。",
        disk_hint="约 0.5–1 GB",
        recommend_long_audio=False,
    ),
    LocalAsrCatalogEntry(
        catalog_id="paraformer-long-vad-punc",
        label="Paraformer 长音频（推荐转写）",
        hub_model_id="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        description="带 VAD、标点与时间戳，适合需要多语段的长音频。",
        disk_hint="约 1–2 GB",
        recommend_long_audio=True,
    ),
)


def resolve_hub_model_id(model_id: str | None) -> str:
    raw = (model_id or "").strip()
    if raw:
        known = {e.hub_model_id for e in LOCAL_ASR_MODEL_CATALOG}
        if raw in known:
            return raw
        # Allow direct hub id for forward compatibility.
        return raw
    return effective_funasr_model_id()


def catalog_entry_for_hub(hub_model_id: str) -> LocalAsrCatalogEntry | None:
    for entry in LOCAL_ASR_MODEL_CATALOG:
        if entry.hub_model_id == hub_model_id:
            return entry
    return None


def get_catalog_status(active_hub_model_id: str | None = None) -> list[dict[str, Any]]:
    from rushi_asr.model_prepare import (  # noqa: PLC0415 — avoid import cycle at module load
        recognizer_model_cached_guess,
        required_models_cached_guess,
    )

    active = (active_hub_model_id or "").strip() or effective_funasr_model_id()
    items: list[dict[str, Any]] = []
    for entry in LOCAL_ASR_MODEL_CATALOG:
        cached = recognizer_model_cached_guess(entry.hub_model_id)
        items.append(
            {
                "catalog_id": entry.catalog_id,
                "label": entry.label,
                "hub_model_id": entry.hub_model_id,
                "description": entry.description,
                "disk_hint": entry.disk_hint,
                "recommend_long_audio": entry.recommend_long_audio,
                "cached": cached,
                "active": entry.hub_model_id == active,
                "ready_for_transcribe": cached and required_models_cached_guess(entry.hub_model_id),
            },
        )
    return items


def is_known_hub_model_id(hub_model_id: str) -> bool:
    return hub_model_id in {e.hub_model_id for e in LOCAL_ASR_MODEL_CATALOG}
