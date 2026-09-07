"""
run.py
------
Convenience entrypoint: `python run.py` starts the API using the
HOST/PORT/RELOAD settings from .env (or their defaults).
"""

import uvicorn

from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
    )
