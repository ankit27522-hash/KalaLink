"""
utils/image_io.py
------------------
Conversions and validation between HTTP-land (raw upload bytes, base64
data URLs) and the OpenCV BGR numpy arrays the enhancement pipeline
operates on. Keeping this separate from the routes/services means neither
of those needs to know about PIL/cv2 plumbing details.
"""

import base64
import io

import cv2
import numpy as np
from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


def validate_upload(upload: UploadFile, data: bytes) -> None:
    """Raises HTTPException (400/413) if the uploaded file fails basic checks."""
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {settings.MAX_UPLOAD_MB}MB upload limit.",
        )

    if upload.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{upload.content_type}'. "
                f"Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
            ),
        )


def bytes_to_bgr(data: bytes) -> np.ndarray:
    """Decodes raw image bytes into an OpenCV BGR array."""
    try:
        pil_img = Image.open(io.BytesIO(data))
        pil_img.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode the uploaded file as an image.",
        ) from exc

    arr = np.array(pil_img.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def bgr_to_base64_png(bgr: np.ndarray) -> str:
    """Encodes an OpenCV BGR array as a base64 `data:image/png;base64,...` URL."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
