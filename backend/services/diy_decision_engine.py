"""Deterministic DIY legality and safety decision engine.

AI output is evidence, never authority.  This module combines that evidence with
user answers and a jurisdiction policy, applies deterministic hazards in a fixed
precedence order, and sanitises the proposed repair plan before it can be returned.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import re
from typing import Any

from models.diy_assessment import DiyAssessment, PolicySource
from models.enums import (
    AssessmentStatus,
    Jurisdiction,
    LegalStatus,
    OverallStatus,
    SafetyLevel,
    SafetyStatus,
)
from services.policy_store import load_policy
from services.diy_validator import assess


_EMERGENCY_PATTERNS = {
    "gas": ("smell of gas", "gas smell", "hissing gas", "active gas leak", "suspected gas leak"),
    "electrical": ("sparking", "arcing", "electric shock", "electrocution", "exposed live wire", "electrical heat", "hot power point"),
    "fire": ("active fire", "flames", "fire damage", "smoke damage", "smoke coming", "burning smell"),
    "collapse": ("possible structural collapse", "imminent collapse", "collapsing", "ceiling falling", "wall falling", "sagging ceiling"),
    "flooding": ("major active leak", "major leak", "flooding"),
    "sewage": ("sewage exposure", "raw sewage", "sewerage spill"),
    "hazardous_material_exposure": ("hazardous material exposure", "hazardous-material exposure", "asbestos dust", "friable asbestos", "chemical exposure"),
}

_HAZARD_PATTERNS = {
    "asbestos": ("asbestos", "fibro", "fibre cement"),
    "electrical": ("electrical", "wiring", "wire", "power point", "light switch", "switchboard"),
    "gas": ("gas pipe", "gas appliance", "gas fitting", "gas line"),
    "structural": ("structural", "load-bearing", "load bearing", "foundation", "subsidence"),
    "work_at_height": ("roof", "ladder", "at height", "elevated work"),
    "mould": ("mould", "mold"),
    "permit_required": ("building permit", "inspection required", "compliance certificate", "permit required"),
}

_SIGNIFICANT_MOULD = ("significant mould", "recurring mould", "widespread mould", "extensive mould")
_UNSAFE_HEIGHT = ("unsafe roof", "steep roof", "fragile roof", "no fall protection", "roof access")
_CAUTION_PATTERNS = ("sand paint", "sanding paint", "peeling paint", "minor mould", "ladder")

_PROHIBITED_STEP_PATTERNS = (
    r"\b(?:repair|replace|install|connect|disconnect|splice|rewire|open)\b.*\b(?:wire|wiring|power point|switchboard|light switch|gas|pipe)\b",
    r"\b(?:remove|cut|drill|sand|scrape|break|demolish)\b.*\b(?:asbestos|fibro|fibre cement)\b",
    r"\b(?:repair|remove|alter|cut|drill)\b.*\b(?:load[- ]bearing|structural|foundation)\b",
    r"\b(?:climb|walk|work)\b.*\b(?:roof|ladder|at height)\b",
)

_BLOCKED_STATUSES = {
    OverallStatus.emergency,
    OverallStatus.professional_required,
    OverallStatus.more_information,
}


@dataclass(frozen=True)
class TaskClassification:
    work_category: str
    task_classification: str


@dataclass(frozen=True)
class DecisionResult:
    assessment: DiyAssessment
    plan: dict[str, Any]
    classification: TaskClassification
    removed_step_count: int


def _normalise(value: Any) -> str:
    if isinstance(value, dict):
        # Field names describe the schema, not observed evidence.  In particular,
        # ``structural_movement: false`` must not become a structural hazard.
        return " ".join(_normalise(item) for item in value.values() if item not in (False, None, ""))
    if isinstance(value, (list, tuple, set)):
        return " ".join(_normalise(item) for item in value)
    return str(value or "").lower().replace("_", " ")


def _combined_evidence(facts: dict, diagnosis: dict, user_answers: dict) -> str:
    return " ".join((_normalise(facts), _normalise(diagnosis), _normalise(user_answers)))


def classify_task(facts: dict, diagnosis: dict, user_answers: dict) -> TaskClassification:
    """Map evidence to the narrow policy taxonomy; unmatched work stays unknown."""
    explicit_category = diagnosis.get("work_category") or facts.get("work_category")
    explicit_task = diagnosis.get("task_classification") or facts.get("task_classification")
    if explicit_category and explicit_task:
        return TaskClassification(str(explicit_category), str(explicit_task))

    text = _combined_evidence(facts, diagnosis, user_answers)
    if "exposed wiring" in text or "exposed wire" in text:
        return TaskClassification("electrical", "repair_exposed_wiring")
    if "power point" in text or "powerpoint" in text:
        return TaskClassification("electrical", "replace_power_point")
    if "light switch" in text:
        return TaskClassification("electrical", "replace_light_switch")
    if any(term in text for term in ("electrical", "wiring", "switchboard")):
        return TaskClassification("electrical", "fixed_electrical_work")
    if any(term in text for term in ("gas appliance", "gas heater", "gas cooktop")):
        return TaskClassification("gasfitting", "connect_gas_appliance")
    if any(term in text for term in ("gas pipe", "gas line", "gas fitting")):
        return TaskClassification("gasfitting", "gas_pipework")
    if any(term in text for term in ("sewer", "below-ground drain", "below ground drain")):
        return TaskClassification("plumbing_drainage", "sewerage_drainage_work")
    if any(term in text for term in ("roof plumbing", "gutter", "downpipe", "stormwater")):
        return TaskClassification("plumbing_roofing_stormwater", "roof_plumbing_stormwater_work")
    if any(term in text for term in ("toilet", "sanitary plumbing")):
        return TaskClassification("plumbing_sanitary", "sanitary_work")
    if any(term in text for term in ("water pipe", "water supply", "plumbing work")):
        return TaskClassification("plumbing_water_supply", "water_supply_work")
    if any(term in text for term in ("structural crack", "load-bearing", "load bearing", "foundation")):
        return TaskClassification("structural", "repair_structural_crack")
    if any(term in text for term in ("asbestos", "fibro", "fibre cement")):
        return TaskClassification("hazardous_material", "suspected_asbestos")
    if any(term in text for term in ("paint", "repaint")):
        return TaskClassification("cosmetic_finishes", "painting")
    if any(term in text for term in ("plaster", "drywall", "gyprock")) and any(
        term in text for term in ("crack", "hole", "patch", "dent")
    ):
        return TaskClassification("cosmetic_finishes", "cosmetic_plaster_repair")
    return TaskClassification("unknown", "unknown_material")


def _matches_any(text: str, patterns: tuple[str, ...]) -> bool:
    return any(pattern in text for pattern in patterns)


def _emergency_categories(text: str) -> list[str]:
    categories = [name for name, patterns in _EMERGENCY_PATTERNS.items() if _matches_any(text, patterns)]
    water = any(term in text for term in ("flood", "standing water", "active leak", "water leak"))
    electricity = any(term in text for term in ("electrical", "wire", "power point", "switchboard"))
    if water and electricity:
        categories.append("water_near_electricity")
    if "water near electrical" in text:
        categories.append("water_near_electricity")
    return categories


def _hazard_categories(text: str) -> list[str]:
    return [name for name, patterns in _HAZARD_PATTERNS.items() if _matches_any(text, patterns)]


def _structured_answer_risks(user_answers: dict) -> tuple[list[str], list[str]]:
    """Interpret boolean answers without treating their field names as evidence."""
    emergencies: list[str] = []
    hazards: list[str] = []
    truthy = {key for key, value in user_answers.items() if value is True}
    for key, category in {
        "gas_smell": "gas",
        "active_sparking": "electrical",
        "exposed_live_wiring": "electrical",
        "burning_smell": "fire",
        "electrical_heat": "electrical",
        "fire_or_smoke_damage": "fire",
        "active_fire": "fire",
        "collapse_imminent": "collapse",
        "sagging_ceiling": "collapse",
        "major_active_leak": "flooding",
        "sewage_exposure": "sewage",
        "immediate_hazardous_material_exposure": "hazardous_material_exposure",
    }.items():
        if key in truthy:
            emergencies.append(category)
    for key, category in {
        "asbestos_possible": "asbestos",
        "lead_paint_possible": "hazardous_coating",
        "structural_movement": "structural",
        "work_at_height": "work_at_height",
        "permit_required": "permit_required",
    }.items():
        if key in truthy:
            hazards.append(category)
    if user_answers.get("water_present") is True and user_answers.get("electrical_nearby") is True:
        emergencies.append("water_near_electricity")
    return emergencies, hazards


def _missing_safety_information(facts: dict, user_answers: dict, classification: TaskClassification) -> list[str]:
    missing: list[str] = []
    if not facts.get("surface_material") or str(facts.get("surface_material")).lower() in {"unknown", "na"}:
        missing.append("What is the surface material?")
        missing.append("Please provide a clear close-up and a wider photo showing the surrounding area.")
    if classification.task_classification in {"painting", "cosmetic_plaster_repair"}:
        if not any(key in user_answers for key in ("building_age", "year_built", "asbestos_possible")):
            missing.append("When was the building constructed, and could this material contain asbestos?")
    if classification.task_classification == "painting":
        condition = facts.get("surrounding_condition") or user_answers.get("surface_condition")
        if not condition:
            missing.append("Is the existing surface sound, dry, and free from flaking or hazardous coatings?")
    if classification.task_classification == "cosmetic_plaster_repair":
        if not any(key in user_answers for key in ("crack_width_mm", "structural_movement", "doors_sticking")):
            missing.append("Is the crack wide, diagonal, recurring, or accompanied by sticking doors or windows?")
    return missing


def _has_contradictory_evidence(facts: dict, user_answers: dict) -> bool:
    pairs = (
        ("moisture_visible", "water_present"),
        ("structural_elements_visible", "structural_movement"),
    )
    for fact_key, answer_key in pairs:
        if fact_key in facts and answer_key in user_answers:
            if isinstance(facts[fact_key], bool) and isinstance(user_answers[answer_key], bool):
                if facts[fact_key] != user_answers[answer_key]:
                    return True
    return bool(user_answers.get("evidence_contradictory"))


def _pending_assessment(
    *,
    status: AssessmentStatus,
    reason: str,
    jurisdiction: Jurisdiction | None = None,
    policy_source: PolicySource | None = None,
    questions: list[str] | None = None,
) -> DiyAssessment:
    return DiyAssessment(
        jurisdiction=jurisdiction,
        safety_level=None,
        assessment_status=status,
        legal_status=LegalStatus.unclear,
        safety_status=SafetyStatus.insufficient_information,
        overall_status=OverallStatus.more_information,
        reason=reason,
        questions_required=questions or [],
        confidence=0,
        policy_source=policy_source or PolicySource(),
    )


def _override_assessment(
    base: DiyAssessment,
    *,
    safety: SafetyStatus,
    overall: OverallStatus,
    reason: str,
    risks: list[str] | None = None,
    warnings: list[str] | None = None,
    questions: list[str] | None = None,
    clear_allowed_actions: bool = False,
) -> DiyAssessment:
    update = {
        "safety_level": {
            OverallStatus.safe_diy: SafetyLevel.safe_diy,
            OverallStatus.caution: SafetyLevel.caution,
            OverallStatus.professional_required: SafetyLevel.professional_required,
            OverallStatus.emergency: SafetyLevel.emergency,
        }.get(overall),
        "assessment_status": (
            AssessmentStatus.complete
            if overall != OverallStatus.more_information
            else AssessmentStatus.more_information_required
        ),
        "safety_status": safety,
        "overall_status": overall,
        "reason": reason,
        "risk_categories": list(dict.fromkeys(base.risk_categories + (risks or []))),
        "warning_signs": list(dict.fromkeys(base.warning_signs + (warnings or []))),
        "questions_required": list(dict.fromkeys(base.questions_required + (questions or []))),
    }
    if clear_allowed_actions:
        update["allowed_actions"] = []
    return base.model_copy(update=update)


def _apply_precedence(
    base: DiyAssessment,
    facts: dict,
    diagnosis: dict,
    user_answers: dict,
    classification: TaskClassification,
) -> DiyAssessment:
    text = _combined_evidence(facts, diagnosis, user_answers)
    emergencies = _emergency_categories(text)
    hazards = _hazard_categories(text)
    answer_emergencies, answer_hazards = _structured_answer_risks(user_answers)
    emergencies = list(dict.fromkeys(emergencies + answer_emergencies))
    hazards = list(dict.fromkeys(hazards + answer_hazards))
    missing = _missing_safety_information(facts, user_answers, classification)
    contradictory = _has_contradictory_evidence(facts, user_answers)

    # 1. Emergency risk.
    if emergencies:
        return _override_assessment(
            base,
            safety=SafetyStatus.emergency,
            overall=OverallStatus.emergency,
            reason="Immediate danger indicators were detected. Keep clear, do not attempt a repair, and contact emergency services or the relevant emergency utility/trade.",
            risks=emergencies,
            warnings=["Do not touch, test, isolate at the hazard, or attempt repair work."],
            clear_allowed_actions=True,
        )
    # 2. Licensed trade required.
    if base.legal_status == LegalStatus.licensed_trade_required:
        return base.model_copy(update={
            "safety_level": SafetyLevel.professional_required,
            "assessment_status": AssessmentStatus.complete,
            "safety_status": SafetyStatus.unsuitable,
            "overall_status": OverallStatus.professional_required,
        })
    # 3. Safety unsuitable / deterministic professional indicators.
    professional_hazards = set(hazards) & {
        "asbestos", "electrical", "gas", "structural", "permit_required"
    }
    if _matches_any(text, _SIGNIFICANT_MOULD):
        professional_hazards.add("significant_mould")
    if _matches_any(text, _UNSAFE_HEIGHT):
        professional_hazards.add("unsafe_work_at_height")
    if base.safety_status == SafetyStatus.unsuitable or professional_hazards:
        return _override_assessment(
            base,
            safety=SafetyStatus.unsuitable,
            overall=OverallStatus.professional_required,
            reason=base.reason or "The evidence indicates work that is unsuitable for DIY and requires a qualified professional.",
            risks=sorted(professional_hazards),
            clear_allowed_actions=True,
        )
    # 4-5. Jurisdiction/policy gates retain their precise pending status.
    if base.assessment_status in {
        AssessmentStatus.jurisdiction_required,
        AssessmentStatus.policy_unverified,
    }:
        return base
    # 6. Legal status unclear.
    if base.legal_status == LegalStatus.unclear:
        return base.model_copy(update={
            "safety_level": None,
            "assessment_status": AssessmentStatus.more_information_required,
            "overall_status": OverallStatus.more_information,
            "questions_required": list(dict.fromkeys(base.questions_required + missing)),
        })
    # 7. Insufficient or contradictory evidence.
    if missing or contradictory:
        questions = list(missing)
        if contradictory:
            questions.append("The photo and answers conflict. Please confirm the condition and provide a new close-up.")
        return _override_assessment(
            base,
            safety=SafetyStatus.insufficient_information,
            overall=OverallStatus.more_information,
            reason="The work may be legally permitted, but critical safety information is missing.",
            questions=questions,
            clear_allowed_actions=True,
        )
    # 8. Caution.
    cosmetic_dent_only = (
        classification.task_classification == "cosmetic_plaster_repair"
        and "dent" in (facts.get("damage_types") or [])
        and not set(facts.get("damage_types") or []) & {"crack", "mould", "water_damage"}
    )
    if (base.safety_status == SafetyStatus.caution and not cosmetic_dent_only) or hazards or _matches_any(text, _CAUTION_PATTERNS):
        return _override_assessment(
            base,
            safety=SafetyStatus.caution,
            overall=OverallStatus.caution,
            reason=base.reason,
            risks=hazards,
        )
    # 9. Safe DIY.
    return base.model_copy(update={
        "safety_level": SafetyLevel.safe_diy,
        "assessment_status": AssessmentStatus.complete,
        "safety_status": SafetyStatus.suitable,
        "overall_status": OverallStatus.safe_diy,
    })


def _step_text(step: Any) -> str:
    return _normalise(step)


def _step_is_prohibited(step: Any, assessment: DiyAssessment) -> bool:
    text = _step_text(step)
    if any(re.search(pattern, text) for pattern in _PROHIBITED_STEP_PATTERNS):
        return True
    return any(_normalise(action) in text for action in assessment.prohibited_actions if action)


def sanitise_plan(plan: dict, assessment: DiyAssessment) -> tuple[dict, int]:
    """Return the only plan representation that may cross the API boundary."""
    safe_plan = deepcopy(plan)
    original_steps = safe_plan.get("steps") if isinstance(safe_plan.get("steps"), list) else []
    if assessment.overall_status in _BLOCKED_STATUSES or assessment.safety_status == SafetyStatus.unsuitable:
        kept_steps: list[Any] = []
    else:
        kept_steps = [step for step in original_steps if not _step_is_prohibited(step, assessment)]
    removed = len(original_steps) - len(kept_steps)
    safe_plan["steps"] = kept_steps

    if removed or assessment.overall_status in _BLOCKED_STATUSES or assessment.safety_status == SafetyStatus.unsuitable:
        safe_plan["materials"] = []
        safe_plan["tools_required"] = []
        safe_plan["inpaint_prompt"] = None
        safe_plan.pop("repair_state", None)
        safe_plan["instructions_suppressed"] = True
        safe_plan["safe_actions"] = list(assessment.allowed_actions)
    else:
        safe_plan["instructions_suppressed"] = False
    return safe_plan, removed


def decide_diy(
    *,
    jurisdiction: str | None,
    facts: dict,
    diagnosis: dict,
    user_answers: dict | None = None,
    repair_plan: dict,
) -> DecisionResult:
    """Combine all evidence, enforce precedence, and return a sanitised plan."""
    answers = user_answers or {}
    classification = classify_task(facts, diagnosis, answers)
    if not jurisdiction:
        base = _pending_assessment(
            status=AssessmentStatus.jurisdiction_required,
            reason="Select the Australian state or territory where the property is located.",
            questions=["Which Australian state or territory is the property in?"],
        )
    else:
        selected = Jurisdiction(jurisdiction)
        policy = load_policy(selected.value)
        if not policy.verified:
            base = _pending_assessment(
                status=AssessmentStatus.policy_unverified,
                reason=f"The DIY policy for {selected.value} has not yet been verified.",
                jurisdiction=selected,
                policy_source=PolicySource(
                    regulator=policy.regulator,
                    url=policy.source_url,
                    effective_date=policy.effective_date,
                    last_reviewed_at=policy.last_reviewed_at.isoformat() if policy.last_reviewed_at else "",
                    policy_version=policy.policy_version,
                ),
                questions=["Consult the relevant state regulator or a licensed professional before proceeding."],
            )
        else:
            base = assess(selected.value, classification.work_category, classification.task_classification)
    final = _apply_precedence(base, facts, diagnosis, answers, classification)
    safe_plan, removed = sanitise_plan(repair_plan, final)
    return DecisionResult(final, safe_plan, classification, removed)


def guard_chat_advice(
    *,
    message: str,
    reply: str,
    jurisdiction: str | None,
    user_answers: dict | None = None,
) -> tuple[str, DiyAssessment, bool]:
    """Apply the same safety boundary to free-text and cached chat advice."""
    answers = user_answers or {}
    decision = decide_diy(
        jurisdiction=jurisdiction,
        facts={
            "surface_material": answers.get("surface_material", "user-described surface"),
            "additional_observations": message,
        },
        diagnosis={"problem": message},
        user_answers=answers,
        repair_plan={"steps": [{"description": reply}], "materials": [], "tools_required": []},
    )
    suppressed = decision.plan.get("instructions_suppressed", False)
    if not suppressed:
        return reply, decision.assessment, False
    lines = [decision.assessment.reason]
    lines.extend(decision.assessment.warning_signs)
    lines.extend(decision.assessment.questions_required)
    return "\n\n".join(dict.fromkeys(line for line in lines if line)), decision.assessment, True
