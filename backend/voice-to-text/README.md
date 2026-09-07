# KalaLink Voice-to-Text Service

A FastAPI backend wrapping [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
to transcribe short voice recordings from the KalaLink frontend's mic-input
fields into text.

This is a separate, independent backend module from `backend/image-enhancement/`
— separate process, separate port, separate dependencies. Nothing here
imports from or depends on the image-enhancement service.

## Setup

```bash
cd backend/voice-to-text
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # adjust CORS_ORIGINS / model size if needed
```

The first request (or server startup) will download the chosen Whisper
model from Hugging Face Hub and cache it locally — this can take a few
minutes the first time depending on model size and connection speed.

## Run

```bash
python run.py
# or
uvicorn app.main:app --reload
```

The API is served at `http://localhost:5000` by default. Interactive docs
(Swagger UI) are available at `http://localhost:5000/docs`.

## Endpoints

| Method | Path                  | Description |
|--------|-----------------------|-------------|
| GET    | `/api/voice/health`   | Liveness check + whether the Whisper model has finished loading |
| POST   | `/api/voice/transcribe` | Multipart upload: `audio` (file, e.g. webm/wav/ogg/mp3). Returns transcribed text plus detected language. |

## No API keys required

This service runs Whisper **locally** via faster-whisper — there is no
external API call and no secret key to configure. If you later swap in a
hosted STT provider (e.g. a cloud speech API), keep the key server-side in
this backend's `.env` and never in the React frontend.

## Model size tradeoffs

Set `WHISPER_MODEL_SIZE` in `.env`: `tiny` < `base` < `small` < `medium` <
`large-v3` (accuracy increases, speed decreases). `medium` on CPU with
`compute_type=int8` (the defaults here) is a reasonable balance for short
form-field recordings.

## Project layout

```
backend/voice-to-text/
├── requirements.txt
├── .env.example
├── run.py
└── app/
    ├── main.py                        # FastAPI app + CORS + startup model load
    ├── core/config.py                 # env-driven settings
    ├── api/routes/transcribe.py       # POST /api/voice/transcribe
    ├── schemas/transcription.py
    ├── services/transcription_service.py   # faster-whisper wrapper
    └── utils/audio_io.py              # upload validation + temp file handling
```

## Known limitations

- First-run model download requires internet access; there's no bundled
  offline model.
- CPU inference with the `medium` model can take a few seconds per clip —
  fine for short (a few seconds) field recordings, less fine for long audio.
- No audio format is bundled/enforced beyond `ALLOWED_AUDIO_TYPES` in
  `.env` — if the frontend records in a codec not in that list (or not in
  `Accept` types your browser produces), loosen the list or transcode
  client-side.
