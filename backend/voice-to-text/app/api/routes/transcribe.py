"""
api/routes/transcribe.py
--------------------------
HTTP surface for the voice-to-text service.

POST /api/voice/transcribe  - upload an audio clip, get back the
                               transcribed text.
GET  /api/voice/health       - liveness + whether the model is loaded.
"""

import time

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.schemas.transcription import HealthResponse, TranscriptionResponse
from app.services.transcription_service import is_model_loaded, transcribe
from app.utils.audio_io import cleanup_temp_file, validate_upload, write_temp_audio

router = APIRouter(prefix="/api/voice", tags=["voice-to-text"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=is_model_loaded(), model_size=settings.WHISPER_MODEL_SIZE)


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Recorded audio clip (webm/wav/ogg/mp3)"),
) -> TranscriptionResponse:
    data = await audio.read()
    validate_upload(audio, data)

    temp_path = write_temp_audio(data, audio.filename or "recording.webm")
    start = time.perf_counter()
    try:
        result = transcribe(temp_path)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {exc}",
        ) from exc
    finally:
        cleanup_temp_file(temp_path)
    elapsed = time.perf_counter() - start

    return TranscriptionResponse(
        text=result.text,
        language_detected=result.language_detected,
        language_confidence=result.language_confidence,
        elapsed_seconds=round(elapsed, 3),
    )
