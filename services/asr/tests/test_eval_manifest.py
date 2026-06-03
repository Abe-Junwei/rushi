"""Tests for eval manifest hotwords resolution (ASR-VOC-5)."""

from rushi_asr.eval_manifest import expand_manifest_runs, resolve_hotwords

ZH_KONG_ITEM = {
    "id": "proper-noun-zhikong",
    "hotwords": "制控",
    "hotwords_ab": {"on": "制控", "off": None},
    "expected_terms": ["制控"],
}


def test_resolve_hotwords_manifest_uses_item_field() -> None:
    hw, enabled = resolve_hotwords(ZH_KONG_ITEM, "manifest")
    assert hw == "制控"
    assert enabled is True


def test_resolve_hotwords_mode_off() -> None:
    hw, enabled = resolve_hotwords(ZH_KONG_ITEM, "off")
    assert hw is None
    assert enabled is False


def test_resolve_hotwords_mode_on_without_ab() -> None:
    hw, enabled = resolve_hotwords(ZH_KONG_ITEM, "on")
    assert hw == "制控"
    assert enabled is True


def test_resolve_hotwords_ab_variant_off() -> None:
    hw, enabled = resolve_hotwords(ZH_KONG_ITEM, "manifest", ab_variant="off")
    assert hw is None
    assert enabled is False


def test_resolve_hotwords_ab_variant_on() -> None:
    hw, enabled = resolve_hotwords(ZH_KONG_ITEM, "manifest", ab_variant="on")
    assert hw == "制控"
    assert enabled is True


def test_expand_manifest_runs_hotwords_ab() -> None:
    runs = expand_manifest_runs(
        [ZH_KONG_ITEM, {"id": "other"}],
        hotwords_ab=True,
        hotwords_mode="manifest",
        filter_id="proper-noun-zhikong",
    )
    assert len(runs) == 2
    assert runs[0][1] == "on"
    assert runs[1][1] == "off"


def test_expand_manifest_runs_without_ab_flag() -> None:
    runs = expand_manifest_runs(
        [ZH_KONG_ITEM],
        hotwords_ab=False,
        hotwords_mode="manifest",
    )
    assert len(runs) == 1
    assert runs[0][1] is None
