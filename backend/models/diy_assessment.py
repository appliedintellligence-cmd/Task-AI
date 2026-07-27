"""Response models for a jurisdiction-aware DIY assessment.

Shape mirrors the agreed `diy_assessment` object. This is attached additively
to analysis results in a later phase; adding it does not alter any existing
response field.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import AssessmentStatus, Jurisdiction, LegalStatus, OverallStatus, SafetyLevel, SafetyStatus

# Bumped when the assessment shape or semantics change.
VALIDATION_VERSION = "2.0"


class PolicySource(BaseModel):
    """Provenance snapshot for the policy the assessment was derived from."""
    regulator: str = ""
    url: str = ""
    effective_date: Optional[date] = None
    last_reviewed_at: str = ""
    policy_version: str = ""


class DiyAssessment(BaseModel):
    """The three-part DIY decision plus supporting context.

    `legal_status`, `safety_status` and `overall_status` are independent
    fields on purpose — legality, situational suitability and the combined
    verdict are distinct decisions.
    """
    jurisdiction: Optional[Jurisdiction] = None
    safety_level: Optional[SafetyLevel] = None
    assessment_status: AssessmentStatus = AssessmentStatus.assessment_pending
    legal_status: LegalStatus
    safety_status: SafetyStatus
    overall_status: OverallStatus
    reason: str = ""
    regulated_work_categories: list[str] = Field(default_factory=list)
    risk_categories: list[str] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)
    questions_required: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)
    prohibited_actions: list[str] = Field(default_factory=list)
    professional_type: Optional[str] = None
    confidence: int = 0
    policy_source: PolicySource = Field(default_factory=PolicySource)
    validation_version: str = VALIDATION_VERSION
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
