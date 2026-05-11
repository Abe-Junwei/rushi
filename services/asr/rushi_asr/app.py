from __future__ import annotations

import os

from fastapi import FastAPI

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8741


def _loopback_only(host: str) -> None:
    allowed = {"127.0.0.1", "localhost", "::1"}
    if host not in allowed:
        raise RuntimeError(
            f"ASR_HOST must be loopback-only (got {host!r}); see plan §10.8 / ADR-0001.",
        )


def create_app() -> FastAPI:
    app = FastAPI(title="rushi-asr", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "rushi-asr"}

    @app.post("/v1/transcribe")
    def transcribe_stub() -> dict[str, str]:
        return {
            "text": "",
            "note": "stub: wire FunASR / SenseVoice / Whisper in a later milestone",
        }

    return app


app = create_app()


def bind_addr() -> tuple[str, int]:
    host = os.environ.get("ASR_HOST", _DEFAULT_HOST).strip() or _DEFAULT_HOST
    _loopback_only(host)
    raw_port = os.environ.get("ASR_PORT", str(_DEFAULT_PORT)).strip() or str(_DEFAULT_PORT)
    port = int(raw_port)
    if port < 1 or port > 65535:
        raise RuntimeError(f"Invalid ASR_PORT: {raw_port!r}")
    return host, port
