"""
services/agent_service.py
--------------------------
The "AI agent" part of the module: given a product image and which
retry attempt this is, it (1) analyzes the image, (2) decides what
enhancement strategy to apply, and (3) calls the enhancer.

This is deliberately NOT an LLM. It's a rule-based decision layer
driven by quality_checker.py's measurements — which is exactly what
makes it defensible as "adaptive" rather than "blindly re-run the
same model": each retry escalates strength AND the agent reacts to
what's actually wrong with THIS image.

Moved from the original KalaLink-Image project's Agent/Agentone.py
(identical logic to the duplicate agent.py at repo root) — this is now
the single copy, importing its sibling services with package-relative
imports instead of the flat-script imports the prototype used.
"""

from dataclasses import dataclass

from app.services.quality_checker import analyze_image
from app.services.enhancer import enhance


@dataclass
class EnhancementPlan:
    attempt: int
    scale: int
    sharpen: bool
    denoise: bool
    backend: str
    reason: str  # human-readable explanation, handy for demo/judges


def decide_strategy(quality: dict, attempt: int) -> EnhancementPlan:
    """
    Core decision rule.

    - attempt 1: respond to what the analyzer actually found.
    - attempt 2 (first retry): escalate scale + strength.
    - attempt 3+ (second retry): maximum strength, force denoise+sharpen,
      always use the real model (no silent fallback) so the user sees
      a genuinely different result.
    """
    reasons = []

    # Baseline decisions from the measured quality
    scale = 4 if quality["low_resolution"] else 2
    sharpen = bool(quality["is_blurry"])
    denoise = bool(quality["is_noisy"])

    if quality["low_resolution"]:
        reasons.append(f"low resolution ({quality['width']}x{quality['height']})")
    if quality["is_blurry"]:
        reasons.append(f"blur detected (score={quality['blur_score']})")
    if quality["is_noisy"]:
        reasons.append(f"noise detected (score={quality['noise_score']})")
    if quality["is_dark"]:
        reasons.append(f"underexposed (brightness={quality['brightness']})")
        sharpen = True  # dark photos usually also look soft; sharpen helps
    if quality["is_overexposed"]:
        reasons.append(f"overexposed (brightness={quality['brightness']})")
    if quality["busy_background"]:
        reasons.append("busy/cluttered background")

    if not reasons:
        reasons.append("image already looks technically clean")

    backend = "auto"

    # Escalate on retry, regardless of what attempt 1 measured - the user
    # said "not satisfied", so give them something visibly stronger.
    if attempt == 2:
        scale = max(scale, 4)
        sharpen = True
        denoise = denoise or quality["is_dark"]
        reasons.append("retry #1: escalating scale + sharpening")
    elif attempt >= 3:
        scale = 4
        sharpen = True
        denoise = True
        backend = "realesrgan"  # force the real model, no classical fallback
        reasons.append("retry #2: maximum-strength pass, forcing Real-ESRGAN")

    return EnhancementPlan(
        attempt=attempt,
        scale=scale,
        sharpen=sharpen,
        denoise=denoise,
        backend=backend,
        reason="; ".join(reasons),
    )


def run_agent(image_bgr, attempt: int = 1):
    """
    Full pipeline for one attempt:
      analyze -> decide -> enhance
    Returns (enhanced_image, plan, quality) so the API can report *why*
    the agent made its choice.
    """
    quality = analyze_image(image_bgr)
    plan = decide_strategy(quality, attempt)
    enhanced = enhance(
        image_bgr,
        scale=plan.scale,
        sharpen=plan.sharpen,
        denoise=plan.denoise,
        backend=plan.backend,
    )
    return enhanced, plan, quality
