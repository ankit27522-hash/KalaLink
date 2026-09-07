"""
utils/audio_io.py
-------------------
Upload validation and temp-file handling for incoming audio clips.
Keeping this separate from the route/service means neither needs to know
about tempfile plumbing or content-type checks.
"""

import os
import tempfile

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


def validate_upload(upload: UploadFile, data: bytes) -> None:
    """Raises HTTPException (400/413) if the uploaded audio fails basic checks."""
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded audio is empty.")

    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio exceeds the {settings.MAX_UPLOAD_MB}MB upload limit.",
        )

    # Browsers (MediaRecorder) commonly send audio/webm or audio/ogg with a
    # codec parameter, e.g. "audio/webm;codecs=opus" - compare on the base
    # MIME type only.
    base_type = (upload.content_type or "").split(";")[0].strip()
    if base_type and base_type not in settings.ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported audio type '{upload.content_type}'. "
                f"Allowed types: {', '.join(settings.ALLOWED_AUDIO_TYPES)}"
            ),
        )


def write_temp_audio(data: bytes, original_filename: str) -> str:
    """Writes the uploaded bytes to a temp file and returns its path.
    faster-whisper (via PyAV/ffmpeg) needs a real file path or file-like
    object with a readable extension to detect the container format."""
    extension = os.path.splitext(original_filename or "")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=extension)
    try:
        tmp.write(data)
    finally:
        tmp.close()
    return tmp.name


def cleanup_temp_file(path: str) -> None:
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass  # best-effort cleanup; not worth failing the request over
