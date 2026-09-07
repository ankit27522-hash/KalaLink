"""
core/config.py
---------------
Centralized, environment-driven configuration for the image-enhancement
service. Nothing in the rest of the app should read `os.environ` directly —
everything goes through the `settings` singleton exported here, so there is
exactly one place that knows how configuration is sourced.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# The service's own root folder: backend/image-enhancement/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load a local .env if present. In production, real env vars (set by the
# host/container) take precedence and this is a no-op if no file exists.
load_dotenv(BASE_DIR / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "true").lower() == "true"

    # --- CORS ---
    CORS_ORIGINS: list[str] = _split_csv(
        os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )

    # --- Uploads ---
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
    MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024
    ALLOWED_IMAGE_TYPES: list[str] = _split_csv(
        os.getenv("ALLOWED_IMAGE_TYPES", "image/jpeg,image/png,image/webp")
    )

    # --- Enhancement engine ---
    DEFAULT_ENHANCEMENT_BACKEND: str = os.getenv("DEFAULT_ENHANCEMENT_BACKEND", "auto")

    _model_path_env = os.getenv("MODEL_PATH", "models/RealESRGAN_x4plus.pth")
    MODEL_PATH: Path = (
        Path(_model_path_env)
        if Path(_model_path_env).is_absolute()
        else BASE_DIR / _model_path_env
    )


settings = Settings()
