"""
services/transcription_service.py
-----------------------------------
Wraps faster-whisper. Adapted from the original prototype's app.py: same
model-loading strategy (singleton, loaded once) and the same transcribe()
call parameters (vad_filter, condition_on_previous_text=False, etc.), just
moved out of the Flask route handler and into its own service module so
the API layer doesn't need to know anything about Whisper internals.
"""

from dataclasses import dataclass
from typing import Optional

from faster_whisper import WhisperModel

from app.core.config import settings

_model_instance: Optional[WhisperModel] = None  # lazy-loaded singleton


@dataclass
class TranscriptionResult:
    text: str
    language_detected: str
    language_confidence: float


def load_model() -> WhisperModel:
    """Loads (and caches) the WhisperModel. Called once at app startup so
    the first real request isn't slowed down by model loading."""
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    print(f"Loading faster-whisper model ({settings.WHISPER_MODEL_SIZE})...")
    _model_instance = WhisperModel(
        settings.WHISPER_MODEL_SIZE,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
    print("Model loaded!")
    return _model_instance


def is_model_loaded() -> bool:
    return _model_instance is not None


def transcribe(audio_path: str) -> TranscriptionResult:
    """Runs the same transcription strategy as the original prototype:
    auto language detection, VAD to strip silence, deterministic decoding
    to avoid hallucinated text."""
    model = load_model()

    segments, info = model.transcribe(
        audio_path,
        language=None,                      # auto-detect
        beam_size=5,
        best_of=5,
        temperature=0.0,                    # deterministic, less prone to invented text
        condition_on_previous_text=False,   # stops it from "hallucinating forward"
        vad_filter=True,                    # cuts silence/noise BEFORE transcribing
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    text = " ".join(segment.text.strip() for segment in segments).strip()

    return TranscriptionResult(
        text=text,
        language_detected=info.language,
        language_confidence=round(info.language_probability, 3),
    )
