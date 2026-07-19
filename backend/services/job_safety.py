"""Safety enforcement at the saved-job trust boundary."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from models.diy_assessment import VALIDATION_VERSION
from services.diy_decision_engine import decide_diy


def validate_result_for_save(result: dict[str, Any]) -> dict[str, Any]:
    """Reassess and sanitise a client-supplied analysis before persistence."""
    incoming = deepcopy(result)
    claimed = incoming.get("diy_assessment") or {}
    jurisdiction = claimed.get("jurisdiction") or incoming.get("jurisdiction")
    classification = incoming.get("diy_classification") or {}
    context = incoming.get("assessment_context") or {}
    diagnosis = {**incoming, **classification}
    decision = decide_diy(
        jurisdiction=jurisdiction,
        facts=incoming,
        diagnosis=diagnosis,
        user_answers=context.get("user_answers") or incoming.get("user_answers") or {},
        repair_plan=incoming,
    )
    safe = decision.plan
    safe["diy_assessment"] = decision.assessment.model_dump(mode="json")
    safe["diy_classification"] = {
        "work_category": decision.classification.work_category,
        "task_classification": decision.classification.task_classification,
    }
    return safe


def enforce_job_read_safety(job: dict[str, Any]) -> dict[str, Any]:
    """Make historical jobs readable but non-actionable until reassessed."""
    safe_job = deepcopy(job)
    result = safe_job.get("result_json") or {}
    assessment = result.get("diy_assessment") or {}
    if assessment.get("validation_version") == VALIDATION_VERSION:
        return safe_job

    result["steps"] = []
    result["materials"] = []
    result["tools_required"] = []
    result["inpaint_prompt"] = None
    result.pop("repair_state", None)
    result["instructions_suppressed"] = True
    result["requires_reassessment"] = True
    result["diy_assessment"] = {
        "safety_level": None,
        "assessment_status": "assessment_pending",
        "legal_status": "unclear",
        "safety_status": "insufficient_information",
        "overall_status": "more_information",
        "reason": "This saved repair predates the current safety assessment and must be reassessed before instructions can resume.",
        "regulated_work_categories": [],
        "risk_categories": [],
        "warning_signs": [],
        "questions_required": ["Select the jurisdiction and reassess the current condition before resuming."],
        "allowed_actions": [],
        "prohibited_actions": ["Do not resume the historical repair instructions before reassessment."],
        "professional_type": None,
        "confidence": 0,
        "jurisdiction": assessment.get("jurisdiction"),
        "policy_source": assessment.get("policy_source") or {},
        "validation_version": VALIDATION_VERSION,
        "assessed_at": None,
    }
    safe_job["result_json"] = result
    return safe_job
