"""Pydantic models aligned with `apps/desktop/src/contracts/transcription.ts`."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SCHEMA_VERSION: Literal["1"] = "1"


class TranscriptionError(BaseModel):
    code: str
    message: str


class TranscriptionSegment(BaseModel):
    start_sec: float = Field(ge=0)
    end_sec: float = Field(ge=0)
    text: str = ""
    confidence: float | None = None
    low_confidence: bool = False
    detail: str | None = None


class TranscriptionResult(BaseModel):
    schema_version: Literal["1"] = SCHEMA_VERSION
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    full_text: str = ""
    engine: str = ""
    duration_sec: float | None = None
    error: TranscriptionError | None = None
    warnings: list[str] = Field(default_factory=list)
