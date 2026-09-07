"""
app/main.py
-----------
FastAPI application factory / entrypoint for the KalaLink image-enhancement
service. Run with:

    uvicorn app.main:app --reload

or simply:

    python run.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.enhance import router as enhance_router
from app.core.config import settings

app = FastAPI(
    title="KalaLink Image Enhancement API",
    description="Adaptive product-photo enhancement service for the KalaLink frontend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enhance_router)


@app.get("/", tags=["root"])
async def root():
    return {
        "service": "kalalink-image-enhancement",
        "status": "running",
        "docs": "/docs",
    }
