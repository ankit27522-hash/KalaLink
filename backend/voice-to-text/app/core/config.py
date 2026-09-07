"""
core/config.py
---------------
Centralized, environment-driven configuration for the voice-to-text
service. Mirrors the pattern used in backend/image-enhancement/app/core/config.py
so the two backend modules stay consistent, even though they're otherwise
fully independent.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "5000"))
    RELOAD: bool = os.getenv("RELOAD", "true").lower() == "true"

    # --- CORS ---
    CORS_ORIGINS: list[str] = _split_csv(
        os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )

    # --- Uploads ---
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "15"))
    MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024
    ALLOWED_AUDIO_TYPES: list[str] = _split_csv(
        os.getenv(
            "ALLOWED_AUDIO_TYPES",
            "audio/webm,audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp4,audio/ogg",
        )
    )

    # --- Whisper model ---
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "medium")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


settings = Settings()
