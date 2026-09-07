"""
services/quality_checker.py
----------------------------
Analyzes a product image and reports quality metrics that the agent
service uses to decide *how* to enhance the image.

No LLM needed here — everything is classic CV (OpenCV/NumPy), which
means it's free, fast, and runs on CPU with no API keys.

Moved from the original KalaLink-Image project's Qualitychecker/Qualitycheck.py
(identical logic to the duplicate quality_checker.py at repo root) — this is
now the single copy, adapted only to accept the pre-decoded numpy arrays the
API layer already produces.
"""

import cv2
import numpy as np
from PIL import Image

# ---- Tunable thresholds -----------------------------------------------
# Starting points — tweak once tested against real product photos.
MIN_GOOD_WIDTH = 800          # below this -> treat as "low resolution"
MIN_GOOD_HEIGHT = 800
BLUR_THRESHOLD = 100.0        # Laplacian variance below this -> blurry
NOISE_THRESHOLD = 15.0        # estimated noise sigma above this -> noisy
DARK_THRESHOLD = 80           # mean brightness (0-255) below this -> too dark
BRIGHT_THRESHOLD = 200        # mean brightness above this -> blown out
BUSY_BG_EDGE_DENSITY = 0.15   # fraction of edge pixels above this -> busy background


def _load_as_bgr(image) -> np.ndarray:
    """Accepts a file path, PIL.Image, or numpy array; returns an OpenCV BGR array."""
    if isinstance(image, str):
        img = cv2.imread(image, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Could not read image at path: {image}")
        return img
    if isinstance(image, Image.Image):
        arr = np.array(image.convert("RGB"))
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    if isinstance(image, np.ndarray):
        return image
    raise TypeError("image must be a file path, PIL.Image, or numpy array")


def _blur_score(gray: np.ndarray) -> float:
    """Variance of the Laplacian. Lower = blurrier."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _noise_score(gray: np.ndarray) -> float:
    """
    Rough noise estimate: high-pass the image (subtract a heavy blur)
    and look at the std-dev of the residual. Not lab-grade, but good
    enough to drive an enhancement decision.
    """
    denoised = cv2.GaussianBlur(gray, (7, 7), 0)
    residual = gray.astype(np.float32) - denoised.astype(np.float32)
    return float(np.std(residual))


def _brightness_score(gray: np.ndarray) -> float:
    return float(np.mean(gray))


def _background_busyness(gray: np.ndarray) -> float:
    """
    Edge density as a proxy for a cluttered background. A clean studio
    background has far fewer edges than a busy/cluttered one.
    """
    edges = cv2.Canny(gray, 100, 200)
    return float(np.count_nonzero(edges)) / edges.size


def analyze_image(image) -> dict:
    """
    Returns a dict of quality metrics + boolean flags the agent can act on:

    {
        "width": int, "height": int,
        "blur_score": float, "is_blurry": bool,
        "noise_score": float, "is_noisy": bool,
        "brightness": float, "is_dark": bool, "is_overexposed": bool,
        "low_resolution": bool,
        "busy_background": bool,
    }
    """
    bgr = _load_as_bgr(image)
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    blur = _blur_score(gray)
    noise = _noise_score(gray)
    brightness = _brightness_score(gray)
    busyness = _background_busyness(gray)

    return {
        "width": w,
        "height": h,
        "low_resolution": (w < MIN_GOOD_WIDTH or h < MIN_GOOD_HEIGHT),
        "blur_score": round(blur, 2),
        "is_blurry": blur < BLUR_THRESHOLD,
        "noise_score": round(noise, 2),
        "is_noisy": noise > NOISE_THRESHOLD,
        "brightness": round(brightness, 2),
        "is_dark": brightness < DARK_THRESHOLD,
        "is_overexposed": brightness > BRIGHT_THRESHOLD,
        "busy_background": busyness > BUSY_BG_EDGE_DENSITY,
    }
