"""
schemas/transcription.py
--------------------------
Pydantic models describing the voice-to-text API's responses.
"""

from typing import Optional
from pydantic import BaseModel


class TranscriptionResponse(BaseModel):
    success: bool = True
    text: str
    language_detected: Optional[str] = None
    language_confidence: Optional[float] = None
    elapsed_seconds: float


class ErrorResponse(BaseModel):
    success: bool = False
    detail: str


class HealthResponse(BaseModel):
    status: str = "ok"
    model_loaded: bool
    model_size: str
