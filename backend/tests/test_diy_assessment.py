"""Tests for the DiyAssessment model and the baseline assessment builder."""

import pytest

from models.diy_assessment import DiyAssessment, PolicySource, VALIDATION_VERSION
from models.enums import Jurisdiction, LegalStatus, OverallStatus, SafetyStatus
from services.diy_validator import baseline_assessment

ALL_CODES = [j.value for j in Jurisdiction]

# The three independent decisions plus supporting context.
EXPECTED_KEYS = {
    "safety_level",
    "assessment_status",
    "assessed_at",
    "jurisdiction",
    "legal_status",
    "safety_status",
    "overall_status",
    "reason",
    "regulated_work_categories",
    "risk_categories",
    "warning_signs",
    "questions_required",
    "allowed_actions",
    "prohibited_actions",
    "professional_type",
    "confidence",
    "policy_source",
    "validation_version",
}


def test_assessment_shape_matches_contract():
    a = DiyAssessment(
        jurisdiction=Jurisdiction.VIC,
        legal_status=LegalStatus.unclear,
        safety_status=SafetyStatus.insufficient_information,
        overall_status=OverallStatus.more_information,
    )
    dumped = a.model_dump()
    assert set(dumped.keys()) == EXPECTED_KEYS
    assert set(dumped["policy_source"].keys()) == {
        "regulator", "url", "effective_date", "last_reviewed_at", "policy_version",
    }


def test_assessment_defaults():
    a = DiyAssessment(
        jurisdiction=Jurisdiction.NSW,
        legal_status=LegalStatus.unclear,
        safety_status=SafetyStatus.insufficient_information,
        overall_status=OverallStatus.more_information,
    )
    assert a.validation_version == VALIDATION_VERSION == "2.0"
    assert a.confidence == 0
    assert a.professional_type is None
    assert a.regulated_work_categories == []
    assert isinstance(a.policy_source, PolicySource)


@pytest.mark.parametrize("code", ALL_CODES)
def test_baseline_unverified_is_unclear(code):
    a = baseline_assessment(code)
    assert a.jurisdiction.value == code
    # Safety-critical guarantee for the data-foundation phase.
    assert a.legal_status == LegalStatus.unclear
    assert a.legal_status != LegalStatus.permitted
    assert a.safety_status == SafetyStatus.insufficient_information
    assert a.overall_status != OverallStatus.safe_diy
    assert a.confidence == 0


@pytest.mark.parametrize("code", ALL_CODES)
def test_baseline_asks_clarifying_questions(code):
    a = baseline_assessment(code)
    assert len(a.questions_required) > 0


@pytest.mark.parametrize("code", ALL_CODES)
def test_baseline_carries_policy_version(code):
    a = baseline_assessment(code)
    assert a.policy_source.policy_version != ""


def test_assessment_json_serialisable():
    a = baseline_assessment("VIC")
    payload = a.model_dump(mode="json")
    assert payload["jurisdiction"] == "VIC"
    assert payload["legal_status"] == "unclear"
    assert payload["validation_version"] == "2.0"


def test_assessment_rejects_invalid_enum():
    with pytest.raises(Exception):
        DiyAssessment(
            jurisdiction="ZZZ",
            legal_status="totally_legal",
            safety_status=SafetyStatus.suitable,
            overall_status=OverallStatus.safe_diy,
        )
