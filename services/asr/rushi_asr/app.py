from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from rushi_asr.engine import transcribe_upload
from rushi_asr.model_cache_env import apply_models_root_env
from rushi_asr.runtime_caps import get_runtime_caps

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8741


def _loopback_only(host: str) -> None:
    allowed = {"127.0.0.1", "localhost", "::1"}
    if host not in allowed:
        raise RuntimeError(
            f"ASR_HOST must be loopback-only (got {host!r}); see plan §10.8 / ADR-0001.",
        )


def create_app() -> FastAPI:
    apply_models_root_env()
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
            "transcribe": "POST /v1/transcribe (multipart: file, optional hotwords)",
            "prepare_model": "POST /v1/models/prepare-default (blocking prefetch)",
            "prepare_model_async": "POST /v1/models/prepare-default/async + GET /v1/models/prepare-status",
        }

    @app.get("/health")
    def health() -> dict[str, object]:
        body: dict[str, object] = {"status": "ok", "service": "rushi-asr"}
        body.update(get_runtime_caps())
        return body

    @app.post("/v1/models/prepare-default")
    def prepare_default_model_endpoint() -> dict[str, object]:
        """Prefetch default FunASR model into MODELSCOPE_CACHE (may take minutes; loopback-only)."""
        try:
            import funasr  # noqa: F401, PLC0415
        except ImportError:
            raise HTTPException(status_code=503, detail="funasr_not_installed") from None

        from rushi_asr.model_prepare import prepare_default_model

        try:
            body = prepare_default_model()
        except (RuntimeError, ValueError, FileNotFoundError) as e:
            code = str(e)
            if code == "model_prepare_disk_full":
                raise HTTPException(status_code=507, detail=code) from e
            if code == "modelscope_not_installed":
                raise HTTPException(status_code=503, detail=code) from e
            if code == "model_manifest_path_missing":
                raise HTTPException(status_code=400, detail=code) from e
            if isinstance(e, ValueError) and ("sha256_mismatch" in code or "manifest_" in code):
                raise HTTPException(status_code=400, detail=code) from e
            raise HTTPException(status_code=500, detail=code) from e
        return body

    @app.post("/v1/models/prepare-default/async")
    def prepare_default_model_async_endpoint() -> dict[str, object]:
        """Start background prefetch; poll ``GET /v1/models/prepare-status``."""
        try:
            import funasr  # noqa: F401, PLC0415
        except ImportError:
            raise HTTPException(status_code=503, detail="funasr_not_installed") from None

        from rushi_asr.model_prepare import start_prepare_default_async

        return start_prepare_default_async()

    @app.get("/v1/models/prepare-status")
    def prepare_default_model_status_endpoint() -> dict[str, object]:
        from rushi_asr.model_prepare import prepare_status

        return prepare_status()

    @app.post("/v1/transcribe")
    async def transcribe(
        file: UploadFile = File(...),
        hotwords: str | None = Form(default=None),
    ) -> dict[str, object]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="missing file name")
        suffix = Path(file.filename).suffix
        tmp = tempfile.mkdtemp(prefix="rushi_asr_")
        tmp_path = Path(tmp)
        try:
            in_path = tmp_path / f"upload{suffix or '.bin'}"
            in_path.write_bytes(await file.read())
            result = transcribe_upload(in_path, tmp_path, hotwords=hotwords)
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
