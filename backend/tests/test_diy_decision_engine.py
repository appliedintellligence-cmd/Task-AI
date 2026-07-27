"""Safety-boundary tests for the deterministic Step 6 decision engine."""

import pytest

from models.enums import LegalStatus, OverallStatus, SafetyStatus
from services.diy_decision_engine import classify_task, decide_diy, guard_chat_advice


def _plan(**overrides):
    plan = {
        "problem": "Small cosmetic wall repair",
        "severity": "low",
        "steps": [{"title": "Patch", "description": "Apply filler and repaint the patch"}],
        "materials": [{"name": "filler"}],
        "tools_required": ["filling knife"],
        "inpaint_prompt": "repaired wall",
    }
    plan.update(overrides)
    return plan


def _decide(*, facts=None, diagnosis=None, answers=None, jurisdiction="VIC", plan=None):
    diagnosis = diagnosis or {
        "work_category": "cosmetic_finishes",
        "task_classification": "painting",
        "problem": "Repaint an interior wall",
    }
    return decide_diy(
        jurisdiction=jurisdiction,
        facts=facts or {"surface_material": "painted plaster"},
        diagnosis=diagnosis,
        user_answers=answers or {},
        repair_plan=plan or _plan(),
    )


def test_safe_diy_requires_verified_permitted_rule():
    result = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "built 2005", "asbestos_possible": False},
    )
    assert result.assessment.legal_status == LegalStatus.permitted
    assert result.assessment.overall_status == OverallStatus.safe_diy
    assert result.plan["instructions_suppressed"] is False
    assert result.plan["steps"]


def test_unverified_jurisdiction_cannot_be_upgraded_by_ai():
    result = _decide(
        jurisdiction="NSW",
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "built 2005", "asbestos_possible": False},
    )
    assert result.assessment.legal_status == LegalStatus.unclear
    assert result.assessment.overall_status == OverallStatus.more_information
    assert result.plan["instructions_suppressed"] is True
    assert result.plan["steps"] == []


def test_emergency_precedes_licensed_trade():
    result = _decide(
        facts={"surface_material": "copper wire", "additional_observations": "Exposed live wire sparking"},
        diagnosis={
            "work_category": "electrical",
            "task_classification": "repair_exposed_wiring",
            "problem": "Exposed live wiring",
        },
        plan=_plan(steps=[{"description": "Tape the live wire"}]),
    )
    assert result.assessment.legal_status == LegalStatus.licensed_trade_required
    assert result.assessment.safety_status == SafetyStatus.emergency
    assert result.assessment.overall_status == OverallStatus.emergency
    assert result.plan["steps"] == []
    assert result.plan["materials"] == []
    assert result.plan["tools_required"] == []
    assert result.plan["inpaint_prompt"] is None


def test_licensed_trade_precedes_missing_information():
    result = _decide(
        facts={"surface_material": "unknown"},
        diagnosis={
            "work_category": "electrical",
            "task_classification": "replace_power_point",
            "problem": "Replace power point",
        },
    )
    assert result.assessment.overall_status == OverallStatus.professional_required
    assert result.assessment.safety_status == SafetyStatus.unsuitable
    assert result.plan["instructions_suppressed"] is True


def test_legal_unclear_precedes_insufficient_safety_information():
    result = _decide(
        facts={"surface_material": "unknown"},
        diagnosis={"work_category": "not_in_policy", "task_classification": "mystery_work"},
    )
    assert result.assessment.legal_status == LegalStatus.unclear
    assert result.assessment.overall_status == OverallStatus.more_information
    assert result.plan["steps"] == []


def test_permitted_plaster_requires_age_and_structural_answers():
    result = _decide(
        facts={"surface_material": "plaster", "damage_types": ["crack"]},
        diagnosis={
            "work_category": "cosmetic_finishes",
            "task_classification": "cosmetic_plaster_repair",
            "problem": "Small plaster crack",
        },
    )
    assert result.assessment.legal_status == LegalStatus.permitted
    assert result.assessment.safety_status == SafetyStatus.insufficient_information
    assert result.assessment.overall_status == OverallStatus.more_information
    assert len(result.assessment.questions_required) >= 2
    assert result.plan["steps"] == []


def test_answered_cosmetic_plaster_repair_remains_caution():
    result = _decide(
        facts={"surface_material": "plaster", "damage_types": ["crack"]},
        diagnosis={
            "work_category": "cosmetic_finishes",
            "task_classification": "cosmetic_plaster_repair",
            "problem": "Small plaster crack",
        },
        answers={"building_age": "built 2005", "crack_width_mm": 1, "structural_movement": False},
    )
    assert result.assessment.overall_status == OverallStatus.caution
    assert result.plan["instructions_suppressed"] is False


def test_prohibited_step_is_removed_even_from_otherwise_safe_plan():
    result = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "built 2005", "asbestos_possible": False},
        plan=_plan(steps=[
            {"description": "Repaint the wall"},
            {"description": "Open the switchboard and replace wiring"},
        ])
    )
    assert result.assessment.overall_status == OverallStatus.safe_diy
    assert len(result.plan["steps"]) == 1
    assert result.removed_step_count == 1
    assert result.plan["materials"] == []
    assert result.plan["tools_required"] == []
    assert result.plan["instructions_suppressed"] is True


def test_visual_evidence_and_user_answers_both_affect_emergency_detection():
    result = _decide(
        facts={"surface_material": "plaster", "additional_observations": "water leak"},
        answers={"nearby_hazard": "standing water below a power point"},
    )
    assert result.assessment.overall_status == OverallStatus.emergency
    assert "water_near_electricity" in result.assessment.risk_categories


def test_boolean_emergency_answer_is_deterministic():
    result = _decide(answers={"gas_smell": True})
    assert result.assessment.overall_status == OverallStatus.emergency


def test_boolean_asbestos_answer_makes_permitted_task_unsuitable():
    result = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "built 1980", "asbestos_possible": True},
    )
    assert result.assessment.safety_status == SafetyStatus.unsuitable
    assert result.assessment.overall_status == OverallStatus.professional_required
    assert result.assessment.allowed_actions == []
    assert result.plan["steps"] == []


def test_classifier_uses_visual_evidence_when_ai_taxonomy_missing():
    classification = classify_task(
        {"surface_material": "plastic", "additional_observations": "damaged power point"},
        {"problem": "Damaged outlet"},
        {},
    )
    assert classification.work_category == "electrical"
    assert classification.task_classification == "replace_power_point"


@pytest.mark.parametrize("jurisdiction", ["NZ", "vic"])
def test_invalid_jurisdiction_is_rejected(jurisdiction):
    with pytest.raises(ValueError):
        _decide(jurisdiction=jurisdiction)


def test_missing_jurisdiction_requires_selection_and_suppresses_steps():
    result = _decide(jurisdiction="")
    assert result.assessment.safety_level is None
    assert result.assessment.assessment_status.value == "jurisdiction_required"
    assert result.plan["steps"] == []


def test_unverified_policy_has_null_level_and_suppresses_steps():
    result = _decide(jurisdiction="NSW")
    assert result.assessment.safety_level is None
    assert result.assessment.assessment_status.value == "policy_unverified"
    assert result.plan["steps"] == []


def test_cosmetic_plaster_dent_level_one():
    result = _decide(
        facts={"surface_material": "plaster", "damage_types": ["dent"]},
        diagnosis={"problem": "Small cosmetic plaster dent"},
        answers={"building_age": "2005", "asbestos_possible": False, "crack_width_mm": 0},
        plan=_plan(steps=[{"description": "Fill the small dent"}]),
    )
    assert result.assessment.safety_level == 1


def test_minor_paint_repair_with_precautions_level_two():
    result = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        diagnosis={
            "work_category": "cosmetic_finishes",
            "task_classification": "painting",
            "problem": "Minor peeling paint repair",
        },
        answers={"building_age": "2005", "asbestos_possible": False},
        plan=_plan(steps=[{"description": "Lightly sand paint wearing a P2 mask"}]),
    )
    assert result.assessment.safety_level == 2


def test_gas_leak_is_level_four():
    result = _decide(facts={"surface_material": "metal", "additional_observations": "suspected gas leak"})
    assert result.assessment.safety_level == 4


def test_new_information_escalates_prior_low_risk_context():
    initial = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "2005", "asbestos_possible": False},
    )
    escalated = _decide(
        facts={"surface_material": "painted plaster", "surrounding_condition": "good"},
        answers={"building_age": "2005", "asbestos_possible": False, "burning_smell": "burning smell"},
    )
    assert initial.assessment.safety_level in (1, 2)
    assert escalated.assessment.safety_level == 4


@pytest.mark.parametrize("classification,problem,professional", [
    (("plumbing_water_supply", "water_supply_work"), "Alter regulated water-supply plumbing", "plumber"),
    (("structural", "repair_structural_crack"), "Repair structural cracking", "building"),
    (("hazardous_material", "suspected_asbestos"), "Suspected asbestos sheeting", "asbestos"),
])
def test_professional_required_scenarios_are_level_three(classification, problem, professional):
    result = _decide(
        facts={"surface_material": "known"},
        diagnosis={
            "work_category": classification[0],
            "task_classification": classification[1],
            "problem": problem,
        },
    )
    assert result.assessment.safety_level == 3
    assert professional in (result.assessment.professional_type or "").lower()
    assert result.plan["steps"] == []


def test_unclear_photo_requests_only_relevant_evidence():
    result = _decide(
        facts={"surface_material": "unknown"},
        diagnosis={"problem": "unclear photograph"},
    )
    assert result.assessment.safety_level is None
    assert result.assessment.assessment_status.value == "more_information_required"
    assert any("photo" in question.lower() for question in result.assessment.questions_required)


def test_direct_chat_api_guard_cannot_return_electrical_instructions():
    unsafe = "Open the power point and replace the exposed wiring with new cable."
    reply, assessment, suppressed = guard_chat_advice(
        message="How do I replace exposed fixed wiring?",
        reply=unsafe,
        jurisdiction="VIC",
    )
    assert assessment.safety_level == 3
    assert suppressed is True
    assert unsafe not in reply
