"""Pydantic models aligned with `apps/desktop/src/contracts/transcription.ts`."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

SCHEMA_VERSION: Literal["1"] = "1"


class TranscriptionError(BaseModel):
    code: str
    message: str


class TranscriptionSegment(BaseModel):
    start_sec: float = Field(ge=0)
    end_sec: float = Field(ge=0)
    text: str = ""
    confidence: float | None = Field(default=None, ge=0, le=1)
    low_confidence: bool = False
    detail: str | None = None

    @model_validator(mode="after")
    def check_times(self) -> TranscriptionSegment:
        if self.end_sec < self.start_sec:
            raise ValueError("end_sec must be >= start_sec")
        return self


class TranscriptionResult(BaseModel):
    schema_version: Literal["1"] = SCHEMA_VERSION
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    full_text: str = ""
    engine: str = ""
    duration_sec: float | None = None
    error: TranscriptionError | None = None
    warnings: list[str] = Field(default_factory=list)
    segmentation_mode: str | None = None
