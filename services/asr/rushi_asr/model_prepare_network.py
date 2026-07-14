"""Transient network retry helpers for ModelScope snapshot_download."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from rushi_asr.model_prepare_progress import PrepareCancelledError, raise_if_prepare_cancelled

log = logging.getLogger(__name__)

_TRANSIENT_HINTS = (
    "connection",
    "timed out",
    "timeout",
    "network",
    "reset by peer",
    "broken pipe",
    "temporarily unavailable",
    "name or service not known",
    "nodename nor servname",
)


def is_transient_network_error(exc: BaseException) -> bool:
    if isinstance(exc, PrepareCancelledError):
        return False
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return True
    name = type(exc).__name__.lower()
    if "timeout" in name or "connection" in name:
        return True
    msg = str(exc).lower()
    return any(hint in msg for hint in _TRANSIENT_HINTS)


def _invoke_snapshot_download(
    snapshot_download: Callable[..., str | Path],
    model_id: str,
    progress_callbacks: Sequence[Any],
) -> Path:
    """Call ModelScope ``snapshot_download``, tolerating API drift.

    Older hub versions accept ``progress_callbacks=…``; newer ones raise
    ``TypeError: unexpected keyword argument 'progress_callbacks'``.
    """
    try:
        return Path(snapshot_download(model_id, progress_callbacks=progress_callbacks))
    except TypeError as exc:
        if "progress_callbacks" not in str(exc):
            raise
        return Path(snapshot_download(model_id))


def snapshot_download_with_retry(
    model_id: str,
    snapshot_download: Callable[..., str | Path],
    progress_callbacks: Sequence[Any],
    *,
    max_attempts: int = 3,
) -> Path:
    last: BaseException | None = None
    for attempt in range(max_attempts):
        raise_if_prepare_cancelled()
        try:
            return _invoke_snapshot_download(snapshot_download, model_id, progress_callbacks)
        except PrepareCancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — classify ModelScope / urllib failures
            last = exc
            if not is_transient_network_error(exc) or attempt >= max_attempts - 1:
                break
            log.warning(
                "model_prepare: transient network error on %s (attempt %s/%s): %s",
                model_id,
                attempt + 1,
                max_attempts,
                exc,
            )
            time.sleep(2.0 * (attempt + 1))
    if last is None:
        raise RuntimeError("model_prepare_failed")
    if is_transient_network_error(last):
        raise RuntimeError("model_prepare_network_error") from last
    if isinstance(last, RuntimeError):
        raise last
    raise RuntimeError("model_prepare_failed") from last
