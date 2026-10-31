from __future__ import annotations

import re
import tomllib
from pathlib import Path

from packaging.version import Version


ASR_ROOT = Path(__file__).resolve().parents[1]
CPU_LOCK = ASR_ROOT / "requirements-sidecar-cpu-macos-arm64.lock"
CUDA_LOCK = ASR_ROOT / "requirements-sidecar-cuda-win_amd64.lock"
EXPECTED_ASR_PINS = {
    "funasr": "1.4.16",
    "modelscope": "1.40.2",
}


def _lock_pin(path: Path, package: str) -> str:
    match = re.search(
        rf"^{re.escape(package)}==([^;\s]+)",
        path.read_text(encoding="utf-8"),
        flags=re.MULTILINE | re.IGNORECASE,
    )
    assert match is not None, f"missing {package} pin in {path.name}"
    return match.group(1)


def test_funasr_extra_uses_exact_validated_pins() -> None:
    config = tomllib.loads((ASR_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    extra = config["project"]["optional-dependencies"]["funasr"]

    assert set(extra) == {
        f"{package}=={version}" for package, version in EXPECTED_ASR_PINS.items()
    }


def test_cpu_lock_matches_validated_asr_pins() -> None:
    for package, expected in EXPECTED_ASR_PINS.items():
        assert _lock_pin(CPU_LOCK, package) == expected


def test_cuda_lock_matches_validated_asr_pins() -> None:
    for package, expected in EXPECTED_ASR_PINS.items():
        assert _lock_pin(CUDA_LOCK, package) == expected


def test_cuda_lock_keeps_validated_cu126_torch_family() -> None:
    assert _lock_pin(CUDA_LOCK, "torch") == "2.11.0+cu126"
    assert _lock_pin(CUDA_LOCK, "torchvision") == "0.26.0+cu126"
    assert _lock_pin(CUDA_LOCK, "torchaudio") == "2.11.0+cu126"


def test_cpu_and_cuda_locks_keep_security_floor_pins() -> None:
    cpu_version = _lock_pin(CPU_LOCK, "cryptography")
    assert Version(cpu_version) >= Version("50.0.0")
    assert _lock_pin(CUDA_LOCK, "cryptography") == cpu_version
