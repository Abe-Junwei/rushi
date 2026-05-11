from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from rushi_asr.engine import transcribe_upload

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
    # Local loopback service: desktop / Vite dev may POST from another origin.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root() -> dict[str, str]:
        """Avoid silent 404 when opening http://127.0.0.1:8741/ in a browser."""
        return {
            "service": "rushi-asr",
            "health": "/health",
            "transcribe": "POST /v1/transcribe (multipart field: file)",
        }

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "rushi-asr"}

    @app.post("/v1/transcribe")
    async def transcribe(file: UploadFile = File(...)) -> dict[str, object]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="missing file name")
        suffix = Path(file.filename).suffix
        tmp = tempfile.mkdtemp(prefix="rushi_asr_")
        tmp_path = Path(tmp)
        try:
            in_path = tmp_path / f"upload{suffix or '.bin'}"
            in_path.write_bytes(await file.read())
            result = transcribe_upload(in_path, tmp_path)
            return result.model_dump()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

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
