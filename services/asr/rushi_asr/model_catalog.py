"""Curated FunASR hub models for desktop catalog (R3g-A)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID, effective_funasr_model_id

_DEPRECATED_HUB_MODEL_IDS = frozenset({"iic/SenseVoiceSmall"})


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
        catalog_id="paraformer-long-vad-punc",
        label="Paraformer 长音频（推荐转写）",
        hub_model_id=DEFAULT_FUNASR_MODEL_ID,
        description="带 VAD、标点与时间戳，适合需要多语段的长音频。",
        disk_hint="约 1–2 GB",
        recommend_long_audio=True,
    ),
)


def migrate_deprecated_hub_model_id(hub_model_id: str) -> str:
    raw = (hub_model_id or "").strip()
    if raw in _DEPRECATED_HUB_MODEL_IDS:
        return DEFAULT_FUNASR_MODEL_ID
    return raw


def resolve_hub_model_id(model_id: str | None) -> str:
    raw = migrate_deprecated_hub_model_id(model_id or "")
    if raw:
        known = {e.hub_model_id for e in LOCAL_ASR_MODEL_CATALOG}
        if raw in known:
            return raw
        # Allow direct hub id for forward compatibility.
        return raw
    return effective_funasr_model_id()


def catalog_entry_for_hub(hub_model_id: str) -> LocalAsrCatalogEntry | None:
    hub = migrate_deprecated_hub_model_id(hub_model_id)
    for entry in LOCAL_ASR_MODEL_CATALOG:
        if entry.hub_model_id == hub:
            return entry
    return None


def get_catalog_status(active_hub_model_id: str | None = None) -> list[dict[str, Any]]:
    from rushi_asr.model_prepare import (  # noqa: PLC0415 — avoid import cycle at module load
        recognizer_model_cached_guess,
        required_models_cached_guess,
    )

    active = migrate_deprecated_hub_model_id(active_hub_model_id or "") or effective_funasr_model_id()
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
    raw = (hub_model_id or "").strip()
    if raw in _DEPRECATED_HUB_MODEL_IDS:
        return False
    return raw in {e.hub_model_id for e in LOCAL_ASR_MODEL_CATALOG}
