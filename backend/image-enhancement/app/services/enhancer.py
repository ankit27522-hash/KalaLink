"""
services/enhancer.py
---------------------
Performs the pixel-level enhancement. Two backends:

1. REAL_ESRGAN  - the real deal (models/RealESRGAN_x4plus.pth). Free,
   runs locally, no API key, no per-image cost. Needs `torch`,
   `torchvision`, `basicsr`, `realesrgan` installed (see requirements.txt)
   and the model weights downloaded once (see README.md "Model setup").

2. CLASSICAL    - a zero-heavy-dependency OpenCV fallback (bicubic
   upscale + CLAHE contrast + unsharp-mask sharpening + optional
   bilateral denoise). Works out of the box with no extra downloads.

Both backends expose the same signature so agent_service.py doesn't care
which one is actually running.

Moved from the original KalaLink-Image project's Enhancer/Enhancer.py
(identical logic to the duplicate enhancer.py at repo root) — this is now
the single copy. The only functional change is that MODEL_PATH is sourced
from app.core.config instead of being hardcoded relative to this file, so
it can be configured per-deployment via the MODEL_PATH env var.
"""

import cv2
import numpy as np

from app.core.config import settings

MODEL_PATH = str(settings.MODEL_PATH)

MAX_OUTPUT_DIMENSION = 2000  # hard cap on the longest side of the enhanced output

_realesrgan_instance = None  # lazy-loaded singleton, expensive to construct


def _get_realesrgan(scale: int):
    """Lazily builds (and caches) a RealESRGANer instance."""
    global _realesrgan_instance
    if _realesrgan_instance is not None:
        return _realesrgan_instance

    import os

    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model weights not found at {MODEL_PATH}. "
            "Download RealESRGAN_x4plus.pth from the official release "
            "(see README.md) and place it in the models/ folder, or set "
            "MODEL_PATH in .env."
        )

    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                     num_block=23, num_grow_ch=32, scale=4)

    _realesrgan_instance = RealESRGANer(
        scale=4,
        model_path=MODEL_PATH,
        model=model,
        tile=200,        # tile the image -> keeps CPU/GPU memory low
        tile_pad=10,
        pre_pad=0,
        half=False,      # half-precision needs a GPU; keep False for CPU
    )
    return _realesrgan_instance


def enhance_realesrgan(image_bgr: np.ndarray, scale: int = 2, **_ignored) -> np.ndarray:
    """
    Runs the real Real-ESRGAN model. `scale` is the *requested* output
    scale (2 or 4); the underlying x4plus model always upsamples 4x
    internally, so for scale=2 we downscale its 4x output back to 2x.
    This keeps file sizes sane for a 2x "light enhance" request.
    """
    upsampler = _get_realesrgan(scale)
    output, _ = upsampler.enhance(image_bgr, outscale=scale)
    return output


def enhance_classical(image_bgr: np.ndarray, scale: int = 2,
                       sharpen: bool = True, denoise: bool = False) -> np.ndarray:
    """
    Dependency-light fallback: bicubic upscale + CLAHE (contrast) +
    unsharp-mask sharpening + optional bilateral denoise.
    """
    img = image_bgr.copy()

    if denoise:
        img = cv2.bilateralFilter(img, d=9, sigmaColor=60, sigmaSpace=60)

    h, w = img.shape[:2]
    target_w, target_h = w * scale, h * scale

    # Never produce an output larger than MAX_OUTPUT_DIMENSION on its longest
    # side — large source photos combined with the requested scale would
    # otherwise produce huge PNGs that browsers can fail to render correctly
    # and that exceed downstream API size limits (e.g. Groq's request cap).
    longest_side = max(target_w, target_h)
    if longest_side > MAX_OUTPUT_DIMENSION:
        shrink = MAX_OUTPUT_DIMENSION / longest_side
        target_w = max(1, int(target_w * shrink))
        target_h = max(1, int(target_h * shrink))

    img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

    # CLAHE contrast boost on the L channel (perceptually closer to "AI enhance")
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)

    if sharpen:
        blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3)
        img = cv2.addWeighted(img, 1.5, blurred, -0.5, 0)

    return img


def enhance(image_bgr: np.ndarray, scale: int = 2, sharpen: bool = True,
            denoise: bool = False, backend: str = "auto") -> np.ndarray:
    """
    Unified entry point used by agent_service.py.

    backend: "auto" (try Real-ESRGAN, fall back to classical on any
              failure), "realesrgan", or "classical".
    """
    if backend in ("auto", "realesrgan"):
        try:
            return enhance_realesrgan(image_bgr, scale=scale)
        except Exception as e:
            if backend == "realesrgan":
                raise
            print(f"[enhancer] Real-ESRGAN unavailable ({e}); using classical fallback.")

    return enhance_classical(image_bgr, scale=scale, sharpen=sharpen, denoise=denoise)


def realesrgan_available() -> bool:
    """Cheap capability probe used by the /api/health endpoint."""
    try:
        import importlib
        importlib.import_module("basicsr")
        importlib.import_module("realesrgan")
    except ImportError:
        return False
    return MODEL_PATH and __import__("os").path.exists(MODEL_PATH)