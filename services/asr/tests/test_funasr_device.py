"""Unit tests for FunASR device resolution (GPU policy)."""

from __future__ import annotations

import sys

import pytest

from rushi_asr import funasr_device
from rushi_asr.funasr_device import funasr_device_health_fields, resolve_funasr_device


def test_resolve_explicit_env_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "cpu")
    assert resolve_funasr_device() == ("cpu", "env")
    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "mps")
    assert resolve_funasr_device() == ("mps", "env")


def test_resolve_blank_env_falls_through_to_auto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "  ")
    monkeypatch.setitem(
        sys.modules,
        "torch",
        type(
            "torch",
            (),
            {
                "cuda": type("cuda", (), {"is_available": staticmethod(lambda: False)})(),
                "backends": type(
                    "backends",
                    (),
                    {
                        "mps": type(
                            "mps",
                            (),
                            {"is_available": staticmethod(lambda: True)},
                        )(),
                    },
                )(),
            },
        )(),
    )
    assert resolve_funasr_device() == ("mps", "auto")


def test_resolve_auto_prefers_cuda_over_mps(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RUSHI_FUNASR_DEVICE", raising=False)
    monkeypatch.setitem(
        sys.modules,
        "torch",
        type(
            "torch",
            (),
            {
                "cuda": type("cuda", (), {"is_available": staticmethod(lambda: True)})(),
                "backends": type(
                    "backends",
                    (),
                    {
                        "mps": type(
                            "mps",
                            (),
                            {"is_available": staticmethod(lambda: True)},
                        )(),
                    },
                )(),
            },
        )(),
    )
    assert resolve_funasr_device() == ("cuda", "auto")


def test_resolve_auto_cpu_when_no_accel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RUSHI_FUNASR_DEVICE", raising=False)
    monkeypatch.setitem(
        sys.modules,
        "torch",
        type(
            "torch",
            (),
            {
                "cuda": type("cuda", (), {"is_available": staticmethod(lambda: False)})(),
                "backends": type(
                    "backends",
                    (),
                    {
                        "mps": type(
                            "mps",
                            (),
                            {"is_available": staticmethod(lambda: False)},
                        )(),
                    },
                )(),
            },
        )(),
    )
    assert resolve_funasr_device() == ("cpu", "auto")


def test_health_fields_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "cpu")
    fields = funasr_device_health_fields()
    assert fields == {"funasr_device": "cpu", "funasr_device_source": "env"}


def test_frozen_macos_arm64_uses_known_mps_variant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RUSHI_FUNASR_DEVICE", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(funasr_device.platform, "machine", lambda: "arm64")

    assert funasr_device_health_fields() == {
        "funasr_device": "mps",
        "funasr_device_source": "auto",
    }


@pytest.mark.parametrize(
    ("executable", "expected"),
    [
        (r"C:\\Rushi\\rushi-asr-sidecar.exe", "cpu"),
        (r"C:\\Rushi\\rushi-asr-sidecar-cuda.exe", "cuda"),
    ],
)
def test_frozen_windows_uses_packaged_variant(
    monkeypatch: pytest.MonkeyPatch,
    executable: str,
    expected: str,
) -> None:
    monkeypatch.delenv("RUSHI_FUNASR_DEVICE", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setattr(sys, "executable", executable)

    assert funasr_device_health_fields() == {
        "funasr_device": expected,
        "funasr_device_source": "auto",
    }
