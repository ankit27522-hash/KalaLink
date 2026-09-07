"""
schemas/enhancement.py
-----------------------
Pydantic models describing the shape of the enhancement API's responses.
Keeping these separate from the service layer means the HTTP contract can
evolve independently of the internal dataclasses used by the agent.
"""

from typing import Optional
from pydantic import BaseModel, Field


class QualityReport(BaseModel):
    width: int
    height: int
    low_resolution: bool
    blur_score: float
    is_blurry: bool
    noise_score: float
    is_noisy: bool
    brightness: float
    is_dark: bool
    is_overexposed: bool
    busy_background: bool


class EnhancementPlan(BaseModel):
    attempt: int
    scale: int
    sharpen: bool
    denoise: bool
    backend: str
    reason: str


class EnhanceResponse(BaseModel):
    success: bool = True
    attempt: int
    quality: QualityReport
    plan: EnhancementPlan
    image: str = Field(..., description="Enhanced image as a base64 data URL (image/png)")
    elapsed_seconds: float


class ErrorResponse(BaseModel):
    success: bool = False
    detail: str


class HealthResponse(BaseModel):
    status: str = "ok"
    realesrgan_available: Optional[bool] = None
