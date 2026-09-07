"""
app/main.py
-----------
FastAPI application entrypoint for the KalaLink voice-to-text service.
Run with:

    uvicorn app.main:app --reload

or simply:

    python run.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.transcribe import router as transcribe_router
from app.core.config import settings
from app.services.transcription_service import load_model

app = FastAPI(
    title="KalaLink Voice-to-Text API",
    description="Speech transcription service for the KalaLink frontend's voice-input fields.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe_router)


@app.on_event("startup")
async def _load_model_on_startup():
    # Load the Whisper model once when the server starts (same strategy as
    # the original prototype) so the first real request isn't slowed down
    # by a multi-second model load.
    load_model()


@app.get("/", tags=["root"])
async def root():
    return {
        "service": "kalalink-voice-to-text",
        "status": "running",
        "docs": "/docs",
    }
