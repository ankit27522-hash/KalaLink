"""
api/routes/enhance.py
----------------------
HTTP surface for the image-enhancement service.

POST /api/enhance   - upload an image, get back the enhanced image + the
                       agent's quality analysis and chosen strategy.
GET  /api/health     - liveness/capability probe.
"""

import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.schemas.enhancement import (
    EnhancementPlan as EnhancementPlanSchema,
    EnhanceResponse,
    HealthResponse,
    QualityReport,
)
from app.services.agent_service import run_agent
from app.services.enhancer import realesrgan_available
from app.utils.image_io import bgr_to_base64_png, bytes_to_bgr, validate_upload

router = APIRouter(prefix="/api", tags=["enhancement"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", realesrgan_available=realesrgan_available())


@router.post("/enhance", response_model=EnhanceResponse)
async def enhance_image(
    image: UploadFile = File(..., description="Product photo to enhance (jpg/png/webp)"),
    attempt: int = Form(1, ge=1, description="1 = first pass, 2+ = retry with escalated strength"),
) -> EnhanceResponse:
    data = await image.read()
    validate_upload(image, data)

    try:
        bgr = bytes_to_bgr(data)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image: {exc}",
        ) from exc

    start = time.perf_counter()
    try:
        enhanced_bgr, plan, quality = run_agent(bgr, attempt=attempt)
    except FileNotFoundError as exc:
        # Real-ESRGAN was explicitly forced (attempt >= 3) but weights are missing.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enhancement failed: {exc}",
        ) from exc
    elapsed = time.perf_counter() - start

    return EnhanceResponse(
        attempt=attempt,
        quality=QualityReport(**quality),
        plan=EnhancementPlanSchema(**plan.__dict__),
        image=bgr_to_base64_png(enhanced_bgr),
        elapsed_seconds=round(elapsed, 3),
    )
