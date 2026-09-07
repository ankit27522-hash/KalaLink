# KalaLink Image Enhancement Service

A FastAPI backend that wraps the adaptive product-photo enhancement agent
(quality analysis → strategy decision → OpenCV/Real-ESRGAN enhancement) and
exposes it over HTTP for the KalaLink React frontend.

## Setup

```bash
cd backend/image-enhancement
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # adjust CORS_ORIGINS / ports if needed
```

## Run

```bash
python run.py
# or
uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`. Interactive docs (Swagger UI)
are available at `http://localhost:8000/docs`.

## Endpoints

| Method | Path           | Description |
|--------|----------------|-------------|
| GET    | `/api/health`  | Liveness check + whether Real-ESRGAN is available |
| POST   | `/api/enhance` | Multipart upload: `image` (file), `attempt` (int, default 1). Returns the enhanced image (base64 PNG data URL) plus the agent's quality report and chosen plan. |

`attempt` mirrors the original agent's retry-escalation design: send `1` on
the first request; if the user clicks "retry", send `2`, then `3`, etc. Each
increment escalates scale/sharpen/denoise and, from attempt 3 onward, forces
the Real-ESRGAN backend.

## Enabling Real-ESRGAN (optional)

By default the service uses a dependency-light classical OpenCV pipeline
(bicubic upscale + CLAHE + unsharp mask), which works with no extra setup.

To use the actual Real-ESRGAN model:

1. Uncomment the `torch`/`torchvision`/`basicsr`/`realesrgan` lines in
   `requirements.txt` and reinstall (`pip install -r requirements.txt`).
   These pull in PyTorch (~500MB-1GB).
2. Download `RealESRGAN_x4plus.pth` from the
   [official Real-ESRGAN releases](https://github.com/xinntao/Real-ESRGAN/releases)
   and place it at `models/RealESRGAN_x4plus.pth` (or point `MODEL_PATH` in
   `.env` at wherever you put it).
3. Set `DEFAULT_ENHANCEMENT_BACKEND=realesrgan` in `.env` if you want to
   force it, or leave it as `auto` to fall back to classical automatically
   if the weights/deps aren't present.

## Project layout

```
backend/image-enhancement/
├── requirements.txt
├── .env.example
├── run.py
├── models/                 # Real-ESRGAN weights go here (not committed)
└── app/
    ├── main.py             # FastAPI app + CORS
    ├── core/config.py      # env-driven settings
    ├── api/routes/enhance.py
    ├── schemas/enhancement.py
    ├── services/
    │   ├── quality_checker.py
    │   ├── enhancer.py
    │   └── agent_service.py
    └── utils/image_io.py
```
