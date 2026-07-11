import logging

from fastapi import APIRouter, UploadFile, File, HTTPException
from services.supabase import upload_image
from services.opencv_metrics import extract_metrics, build_metrics_context
from services.openrouter import (
    extract_facts_qwen,
    generate_repair_plan_nemotron,
    NEMOTRON_SUPER,
)
from services.validator import validate_facts, validate_plan, confidence_level
from services.repair_state import build_repair_state

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

    if cv_metrics["opencv_status"] == "success":
        upload_bytes = enhanced_bytes
        logger.info("Using OpenCV enhanced image")
    else:
        upload_bytes = image_bytes
        logger.warning(f"OpenCV failed: {cv_metrics['opencv_status']}")

    image_url = None
    try:
        filename = file.filename or "upload.jpg"
        image_url = await upload_image(upload_bytes, filename)
    except Exception as e:
        print(f"Storage upload failed (non-fatal): {e}")

    # ════════════════════════════════════════════════
    # STAGE 2-4 — Groq Maverick vision → Nemotron repair plan
    # ════════════════════════════════════════════════
    try:
        facts = await extract_facts_qwen(upload_bytes, metrics_context)
        facts_ok, facts_err = validate_facts(facts)

        if not facts_ok:
            logger.warning(f"Facts invalid: {facts_err}")
            raise ValueError(facts_err)

        plan = await generate_repair_plan_nemotron(facts, metrics_context)
        plan_ok, plan_err = validate_plan(plan)

        if not plan_ok:
            logger.warning(f"Plan invalid: {plan_err}. Retrying with Nemotron Super.")
            plan = await generate_repair_plan_nemotron(
                facts, metrics_context, model=NEMOTRON_SUPER
            )
            plan_ok, plan_err = validate_plan(plan)

            if not plan_ok:
                raise ValueError(f"Retry failed: {plan_err}")

        # ════════════════════════════════════════════════
        # STAGE 3.5 — Repair State Engine
        # ════════════════════════════════════════════════
        repair_state_patch = build_repair_state(facts, plan)
        logger.info(
            f"Repair state built. Prompt confidence: "
            f"{repair_state_patch['repair_state']['prompt_confidence']}%"
        )

        result = {**facts, **plan, **repair_state_patch}
        result["image_url"] = image_url
        result["opencv_metrics"] = cv_metrics
        result["confidence_level"] = confidence_level(plan.get("confidence", 0))
        result["pipeline"] = "opencv-maverick-nemotron-rse"
        logger.info(f"Pipeline success. Confidence: {plan.get('confidence')}%")

    except Exception as e:
        logger.error(f"Analysis pipeline failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. Try again or upload a clearer photo.",
        )

    return result
