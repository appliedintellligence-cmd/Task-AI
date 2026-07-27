import json
import logging

import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from dependencies import authenticated_user
from models.enums import Jurisdiction
from services.supabase import upload_private_image
from services.opencv_metrics import extract_metrics, build_metrics_context
from services.openrouter import (
    extract_facts_qwen,
    generate_repair_plan_nemotron,
    NEMOTRON_SUPER,
)
from services.validator import validate_facts, validate_plan, confidence_level
from services.repair_state import build_repair_state
from services.diy_decision_engine import decide_diy

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyse")
async def analyse(
    file: UploadFile = File(...),
    jurisdiction: str | None = Form(None),
    user_answers: str = Form("{}"),
    user_id: str = Depends(authenticated_user),
):
    try:
        if jurisdiction:
            Jurisdiction(jurisdiction)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unsupported Australian jurisdiction") from exc
    try:
        parsed_answers = json.loads(user_answers)
        if not isinstance(parsed_answers, dict):
            raise ValueError("user_answers must be a JSON object")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="user_answers must be a JSON object") from exc

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    # ════════════════════════════════════════════════
    # STAGE 1.5 — OpenCV objective metrics
    # ════════════════════════════════════════════════
    cv_metrics, enhanced_bytes = extract_metrics(image_bytes)
    metrics_context = build_metrics_context(cv_metrics)

    if cv_metrics["opencv_status"] == "success":
        upload_bytes = enhanced_bytes
        upload_content_type = "image/jpeg"
        logger.info("Using OpenCV enhanced image")
    else:
        upload_bytes = image_bytes
        upload_content_type = file.content_type
        logger.warning(f"OpenCV failed: {cv_metrics['opencv_status']}")

    job_id = str(uuid.uuid4())
    photo = {}
    try:
        filename = file.filename or "upload.jpg"
        photo = await upload_private_image(
            user_id, job_id, upload_bytes, filename, upload_content_type
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("Private storage upload failed")
        raise HTTPException(status_code=503, detail="Photo storage is temporarily unavailable") from exc

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

        # The LLM plan is evidence only.  Deterministic policy/hazard rules make
        # the decision and sanitise instructions before they can leave the API.
        decision = decide_diy(
            jurisdiction=jurisdiction,
            facts=facts,
            diagnosis=plan,
            user_answers=parsed_answers,
            repair_plan=plan,
        )
        safe_plan = decision.plan

        repair_state_patch = {}
        if not safe_plan.get("instructions_suppressed"):
            repair_state_patch = build_repair_state(facts, safe_plan)
            logger.info(
                f"Repair state built. Prompt confidence: "
                f"{repair_state_patch['repair_state']['prompt_confidence']}%"
            )

        result = {**facts, **safe_plan, **repair_state_patch}
        result["diy_assessment"] = decision.assessment.model_dump(mode="json")
        result["diy_classification"] = {
            "work_category": decision.classification.work_category,
            "task_classification": decision.classification.task_classification,
        }
        result["assessment_context"] = {
            "jurisdiction": jurisdiction,
            "user_answers": parsed_answers,
        }
        result.update(photo)
        result["job_id"] = job_id
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
