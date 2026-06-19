from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import Response

from rushi_asr.engine import transcribe_upload
from rushi_asr.model_cache_env import apply_models_root_env, configure_hub_env
from rushi_asr.runtime_caps import get_runtime_caps

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8741
_TOKEN_HEADER = "x-rushi-local-token"
# Guard against OOM / abuse on loopback (adjust via env if needed).
_MAX_UPLOAD_BYTES = int(os.environ.get("RUSHI_MAX_UPLOAD_BYTES", str(512 * 1024 * 1024)))
_READ_CHUNK = 1024 * 1024


class TranscribeCancelRequest(BaseModel):
    job_id: str


def _loopback_only(host: str) -> None:
    allowed = {"127.0.0.1", "localhost", "::1"}
    if host not in allowed:
        raise RuntimeError(
            f"ASR_HOST must be loopback-only (got {host!r}); see plan §10.8 / ADR-0001.",
        )


def _require_local_token(request: Request) -> None:
    """Optional local token gate for mutating endpoints (set RUSHI_LOCAL_TOKEN to enable)."""
    configured = os.environ.get("RUSHI_LOCAL_TOKEN", "").strip()
    if not configured:
        return
    token = request.headers.get(_TOKEN_HEADER, "").strip()
    if token != configured:
        raise HTTPException(status_code=401, detail="invalid_local_token")


class PrepareModelRequest(BaseModel):
    model_id: str | None = Field(default=None, description="FunASR hub model id")


async def read_upload_to_temp(
    file: UploadFile,
    tmp_path: Path,
) -> Path:
    """Stream multipart upload to disk (bounded memory)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="missing file name")
    suffix = Path(file.filename).suffix
    in_path = tmp_path / f"upload{suffix or '.bin'}"
    total = 0
    try:
        with in_path.open("wb") as out:
            while True:
                chunk = await file.read(_READ_CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="upload_too_large")
                out.write(chunk)
    except HTTPException:
        in_path.unlink(missing_ok=True)
        raise
    except Exception:
        in_path.unlink(missing_ok=True)
        raise
    return in_path


def create_app() -> FastAPI:
    configure_hub_env()
    app = FastAPI(title="rushi-asr", version="0.1.0")
    # Local loopback service: desktop / Vite dev may POST from another origin.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["tauri://localhost", "http://localhost", "http://127.0.0.1"],
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def private_network_access(request: Request, call_next) -> Response:
        """Chrome Private Network Access preflight for http://localhost → loopback."""
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    @app.get("/")
    def root() -> dict[str, str]:
        """Avoid silent 404 when opening http://127.0.0.1:8741/ in a browser."""
        return {
            "service": "rushi-asr",
            "health": "/health",
            "transcribe": "POST /v1/transcribe (multipart: file, optional hotwords)",
            "prepare_model": "POST /v1/models/prepare (blocking prefetch, optional model_id)",
            "prepare_model_async": "POST /v1/models/prepare/async + GET /v1/models/prepare-status",
            "prepare_cancel": "POST /v1/models/prepare-cancel",
            "warmup_model": "POST /v1/models/warmup",
            "transcribe_async": "POST /v1/transcribe/async + GET /v1/transcribe/status",
            "transcribe_cancel": "POST /v1/transcribe/cancel",
            "model_catalog": "GET /v1/models/catalog",
        }

    @app.get("/health")
    def health() -> dict[str, object]:
        body: dict[str, object] = {"status": "ok", "service": "rushi-asr"}
        body.update(get_runtime_caps())
        return body

    @app.get("/v1/models/catalog")
    def models_catalog_endpoint() -> dict[str, object]:
        from rushi_asr.model_catalog import get_catalog_status

        return {"items": get_catalog_status()}

    async def _prepare_model_blocking(model_id: str | None) -> dict[str, object]:
        from rushi_asr.model_prepare import prepare_model

        try:
            return await run_in_threadpool(lambda: prepare_model(model_id))
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

    def _require_funasr_import() -> None:
        try:
            import funasr  # noqa: F401, PLC0415
        except ImportError:
            raise HTTPException(status_code=503, detail="funasr_not_installed") from None

    @app.post("/v1/models/prepare")
    async def prepare_model_endpoint(
        request: Request,
        body: PrepareModelRequest = Body(default_factory=PrepareModelRequest),
    ) -> dict[str, object]:
        """Prefetch a FunASR hub model into MODELSCOPE_CACHE (may take minutes; loopback-only)."""
        _require_local_token(request)
        _require_funasr_import()
        return await _prepare_model_blocking(body.model_id)

    @app.post("/v1/models/prepare-default")
    async def prepare_default_model_endpoint(request: Request) -> dict[str, object]:
        """Backward-compatible blocking prefetch for the effective default hub model."""
        _require_local_token(request)
        _require_funasr_import()
        return await _prepare_model_blocking(None)

    @app.post("/v1/models/prepare/async")
    def prepare_model_async_endpoint(
        request: Request,
        body: PrepareModelRequest = Body(default_factory=PrepareModelRequest),
    ) -> dict[str, object]:
        """Start background prefetch; poll ``GET /v1/models/prepare-status``."""
        _require_local_token(request)
        _require_funasr_import()
        from rushi_asr.model_prepare import start_prepare_async

        return start_prepare_async(body.model_id)

    @app.post("/v1/models/prepare-default/async")
    def prepare_default_model_async_endpoint(request: Request) -> dict[str, object]:
        """Backward-compatible async prefetch for the effective default hub model."""
        _require_local_token(request)
        _require_funasr_import()
        from rushi_asr.model_prepare import start_prepare_default_async

        return start_prepare_default_async()

    @app.get("/v1/models/prepare-status")
    def prepare_default_model_status_endpoint() -> dict[str, object]:
        from rushi_asr.model_prepare import prepare_status

        return prepare_status()

    @app.post("/v1/models/prepare-cancel")
    def prepare_cancel_endpoint(request: Request) -> dict[str, object]:
        """Cooperative cancel for async model prefetch (Q-R3g-3)."""
        _require_local_token(request)
        from rushi_asr.model_prepare import cancel_prepare_async

        return cancel_prepare_async()

    @app.post("/v1/models/warmup")
    async def warmup_model_endpoint(request: Request) -> dict[str, object]:
        """Load FunASR AutoModel into memory."""
        _require_local_token(request)
        _require_funasr_import()
        from rushi_asr.funasr_engine import warmup_funasr_model

        try:
            return await run_in_threadpool(warmup_funasr_model)
        except RuntimeError as e:
            code = str(e)
            if code == "funasr_not_installed":
                raise HTTPException(status_code=503, detail=code) from e
            if code in ("funasr_model_not_configured", "funasr_models_not_ready"):
                raise HTTPException(status_code=503, detail=code) from e
            raise HTTPException(status_code=500, detail=code) from e

    @app.post("/v1/transcribe")
    async def transcribe(
        request: Request,
        file: UploadFile = File(...),
        hotwords: str | None = Form(default=None),
    ) -> dict[str, object]:
        _require_local_token(request)
        tmp = await run_in_threadpool(lambda: tempfile.mkdtemp(prefix="rushi_asr_"))
        tmp_path = Path(tmp)
        try:
            in_path = await read_upload_to_temp(file, tmp_path)
            result = await run_in_threadpool(transcribe_upload, in_path, tmp_path, hotwords)
            return result.model_dump()
        finally:
            await run_in_threadpool(shutil.rmtree, str(tmp_path), True)

    @app.post("/v1/transcribe/async")
    async def transcribe_async(
        request: Request,
        file: UploadFile = File(...),
        hotwords: str | None = Form(default=None),
    ) -> dict[str, object]:
        """Start background transcribe; poll ``GET /v1/transcribe/status`` (R3e-C)."""
        _require_local_token(request)
        from rushi_asr.transcribe_job import start_transcribe_async

        tmp = await run_in_threadpool(lambda: tempfile.mkdtemp(prefix="rushi_asr_job_"))
        tmp_path = Path(tmp)
        handoff_to_job = False
        try:
            in_path = await read_upload_to_temp(file, tmp_path)
            # Job thread owns tmp_path cleanup after successful handoff.
            out = start_transcribe_async(in_path, tmp_path, hotwords)
            handoff_to_job = True
            return out
        except RuntimeError as e:
            if str(e) == "transcribe_job_limit":
                raise HTTPException(status_code=429, detail="transcribe_job_limit") from e
            raise
        finally:
            if not handoff_to_job:
                await run_in_threadpool(shutil.rmtree, str(tmp_path), True)

    @app.get("/v1/transcribe/status")
    def transcribe_status_endpoint(job_id: str) -> dict[str, object]:
        from rushi_asr.transcribe_job import transcribe_status

        return transcribe_status(job_id)

    @app.post("/v1/transcribe/cancel")
    def transcribe_cancel_endpoint(
        request: Request,
        body: TranscribeCancelRequest = Body(...),
    ) -> dict[str, object]:
        _require_local_token(request)
        from rushi_asr.transcribe_job import cancel_transcribe

        return cancel_transcribe(body.job_id)

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
