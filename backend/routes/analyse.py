import os
import json
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException
from services.gemini import analyse_image
from services.supabase import upload_image
from services.opencv_metrics import extract_metrics, build_metrics_context
from services.openrouter import (
    extract_facts_qwen,
    generate_repair_plan_nemotron,
    NEMOTRON_SUPER
)
from services.validator import validate_facts, validate_plan, confidence_level

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyse")
async def analyse(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    # ════════════════════════════════════════════════
    # STAGE 1.5 — OpenCV objective metrics
    # ════════════════════════════════════════════════
    cv_metrics, enhanced_bytes = extract_metrics(image_bytes)
    metrics_context = build_metrics_context(cv_metrics)

    # Use enhanced image for upload
    if cv_metrics["opencv_status"] == "success":
        upload_bytes = enhanced_bytes
        logger.info("Using OpenCV enhanced image")
    else:
        upload_bytes = image_bytes
        logger.warning(f"OpenCV failed: {cv_metrics['opencv_status']}")

    # Upload to Supabase Storage (non-blocking — analysis proceeds even if upload fails)
    image_url = None
    try:
        filename = file.filename or "upload.jpg"
        image_url = await upload_image(upload_bytes, filename)
    except Exception as e:
        print(f"Storage upload failed (non-fatal): {e}")

    # ════════════════════════════════════════════════
    # STAGE 2-4 — OpenRouter pipeline
    # Falls back to Gemini if OpenRouter unavailable
    # ════════════════════════════════════════════════
    result = None
    pipeline_used = "unknown"

    if os.getenv("GROQ_API_KEY"):
        try:
            # STAGE 2: Qwen-VL — visual facts only
            facts = await extract_facts_qwen(image_url, metrics_context)
            facts_ok, facts_err = validate_facts(facts)

            if not facts_ok:
                logger.warning(f"Qwen facts invalid: {facts_err}")
                raise ValueError(facts_err)

            # STAGE 3: Nemotron — CoT repair reasoning
            plan = await generate_repair_plan_nemotron(facts, metrics_context)
            plan_ok, plan_err = validate_plan(plan)

            # STAGE 4: Validate + retry with Super
            if not plan_ok:
                logger.warning(
                    f"Plan invalid: {plan_err}. "
                    f"Retrying with Nemotron Super."
                )
                plan = await generate_repair_plan_nemotron(
                    facts,
                    metrics_context,
                    model=NEMOTRON_SUPER
                )
                plan_ok, plan_err = validate_plan(plan)

                if not plan_ok:
                    raise ValueError(f"Retry failed: {plan_err}")

            # Merge everything
            result = {**facts, **plan}
            result["image_url"] = image_url
            result["opencv_metrics"] = cv_metrics
            result["confidence_level"] = confidence_level(
                plan.get("confidence", 0)
            )
            result["pipeline"] = "opencv-qwen-nemotron"
            pipeline_used = "opencv-qwen-nemotron"
            logger.info(
                f"Pipeline success. "
                f"Confidence: {plan.get('confidence')}%"
            )

        except Exception as e:
            logger.error(
                f"OpenRouter pipeline failed: {e}. "
                f"Falling back to Gemini."
            )
            result = None

    # ════════════════════════════════════════════════
    # GEMINI FALLBACK — existing code
    # ════════════════════════════════════════════════
    if result is None:
        try:
            result = await analyse_image(image_bytes)
            result["image_url"] = image_url
            result["opencv_metrics"] = cv_metrics
            result["pipeline"] = "gemini-fallback"
            result["confidence"] = 70
            result["confidence_level"] = "medium"
            pipeline_used = "gemini-fallback"
            logger.info("Gemini fallback succeeded")
        except Exception as e:
            logger.error(f"Gemini fallback failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Analysis failed. Try again or "
                       "upload a clearer photo."
            )

    return result
