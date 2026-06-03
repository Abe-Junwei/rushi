"""Eval manifest helpers: hotwords mode / A-B resolution (ASR-VOC-5)."""

from __future__ import annotations

from typing import Any, Literal

HotwordsMode = Literal["manifest", "on", "off"]
AbVariant = Literal["on", "off"]


def resolve_hotwords(
    item: dict[str, Any],
    mode: HotwordsMode,
    *,
    ab_variant: AbVariant | None = None,
) -> tuple[str | None, bool]:
    """
    Return (hotwords for POST /v1/transcribe, hotwords_enabled flag).

    ``ab_variant`` is set when ``--hotwords-ab`` expands an item into on/off runs.
    """
    ab = item.get("hotwords_ab")
    if ab_variant == "off":
        return None, False
    if ab_variant == "on":
        if isinstance(ab, dict):
            on_val = ab.get("on")
            if on_val is None:
                on_val = item.get("hotwords")
            text = (str(on_val) if on_val is not None else "").strip()
            return (text or None), bool(text)
        text = (item.get("hotwords") or "").strip()
        return (text or None), bool(text)

    if mode == "off":
        return None, False
    if mode == "on":
        if isinstance(ab, dict):
            on_val = ab.get("on")
            if on_val is not None:
                text = str(on_val).strip()
                if text:
                    return text, True
        text = (item.get("hotwords") or "").strip()
        return (text or None), bool(text)
    # manifest: per-item hotwords field only
    text = (item.get("hotwords") or "").strip()
    return (text or None), bool(text)


def expand_manifest_runs(
    items: list[Any],
    *,
    hotwords_ab: bool,
    hotwords_mode: HotwordsMode,
    filter_id: str | None = None,
) -> list[tuple[dict[str, Any], AbVariant | None]]:
    """Expand manifest items into transcribe runs (one or two per item for A/B)."""
    runs: list[tuple[dict[str, Any], AbVariant | None]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        iid = raw.get("id", "")
        if filter_id and iid != filter_id:
            continue
        if hotwords_ab and isinstance(raw.get("hotwords_ab"), dict):
            runs.append((raw, "on"))
            runs.append((raw, "off"))
        else:
            runs.append((raw, None))
    return runs
