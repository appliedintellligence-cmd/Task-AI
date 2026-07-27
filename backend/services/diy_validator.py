"""Resolve a DIY assessment from stored jurisdiction policy.

Two independent inputs, kept separate on purpose:
  * legal_status  — comes straight from a cited policy rule (or 'unclear').
  * safety_status — situational suitability; a rule may assert it, otherwise it
                    is derived conservatively from the legal status.
`overall_status` is the combined verdict derived from both.

Safety-critical guarantees:
  * An unverified jurisdiction always resolves to legal_status 'unclear'.
  * A task with no matching verified rule resolves to 'unclear', never permitted.
"""

from __future__ import annotations

from typing import Optional

from models.diy_assessment import DiyAssessment, PolicySource
from models.enums import AssessmentStatus, Jurisdiction, LegalStatus, OverallStatus, SafetyLevel, SafetyStatus
from models.policy import JurisdictionPolicy, PolicyRule
from services.policy_store import load_policy

_UNVERIFIED_REASON = (
    "DIY legality for this jurisdiction has not yet been verified. Confirm the "
    "specific work with the relevant state or territory regulator, or engage a "
    "licensed professional, before proceeding."
)

_NO_MATCH_REASON = (
    "This task does not match a verified rule for {jur}. Treated as unclear: "
    "confirm the specific work with the relevant regulator before proceeding."
)

_BASE_QUESTIONS = [
    "Which Australian state or territory is the property in?",
    "What type of work is involved (e.g. electrical, plumbing, gas, structural)?",
]


# ── status derivation ────────────────────────────────────────────────────────

def _default_safety(legal_status: LegalStatus, professional_type: Optional[str]) -> SafetyStatus:
    if legal_status == LegalStatus.permitted:
        return SafetyStatus.suitable
    if legal_status == LegalStatus.licensed_trade_required:
        return SafetyStatus.unsuitable
    # unclear
    return SafetyStatus.caution if professional_type else SafetyStatus.insufficient_information


def _derive_overall(
    legal_status: LegalStatus,
    safety_status: SafetyStatus,
    professional_type: Optional[str],
) -> OverallStatus:
    if safety_status == SafetyStatus.emergency:
        return OverallStatus.emergency
    if legal_status == LegalStatus.licensed_trade_required:
        return OverallStatus.professional_required
    if legal_status == LegalStatus.unclear:
        if professional_type or safety_status == SafetyStatus.unsuitable:
            return OverallStatus.professional_required
        return OverallStatus.more_information
    # permitted
    if safety_status == SafetyStatus.suitable:
        return OverallStatus.safe_diy
    if safety_status == SafetyStatus.caution:
        return OverallStatus.caution
    if safety_status == SafetyStatus.unsuitable:
        return OverallStatus.professional_required
    return OverallStatus.safe_diy


def _default_confidence(legal_status: LegalStatus) -> int:
    return 10 if legal_status == LegalStatus.unclear else 90


# ── policy source snapshots ──────────────────────────────────────────────────

def _policy_source_from_policy(policy: JurisdictionPolicy) -> PolicySource:
    return PolicySource(
        regulator=policy.regulator,
        url=policy.source_url,
        effective_date=policy.effective_date,
        last_reviewed_at=policy.last_reviewed_at.isoformat() if policy.last_reviewed_at else "",
        policy_version=policy.policy_version,
    )


def _policy_source_from_rule(rule: PolicyRule) -> PolicySource:
    return PolicySource(
        regulator=rule.source_regulator,
        url=rule.source_url,
        effective_date=rule.effective_date,
        last_reviewed_at=rule.last_reviewed_at.isoformat() if rule.last_reviewed_at else "",
        policy_version=rule.policy_version,
    )


# ── public API ───────────────────────────────────────────────────────────────

def baseline_assessment(jurisdiction: str) -> DiyAssessment:
    """Conservative baseline used when no specific task is supplied.

    For an unverified/placeholder policy this is always legal_status 'unclear'.
    """
    policy = load_policy(jurisdiction)
    if not policy.verified:
        return DiyAssessment(
            jurisdiction=Jurisdiction(jurisdiction),
            assessment_status=AssessmentStatus.policy_unverified,
            legal_status=LegalStatus.unclear,
            safety_status=SafetyStatus.insufficient_information,
            overall_status=OverallStatus.more_information,
            reason=_UNVERIFIED_REASON,
            questions_required=list(_BASE_QUESTIONS),
            confidence=0,
            policy_source=_policy_source_from_policy(policy),
        )
    return DiyAssessment(
        jurisdiction=Jurisdiction(jurisdiction),
        assessment_status=AssessmentStatus.more_information_required,
        legal_status=LegalStatus.unclear,
        safety_status=SafetyStatus.insufficient_information,
        overall_status=OverallStatus.more_information,
        reason="No specific task supplied; defaulting to unclear.",
        questions_required=list(_BASE_QUESTIONS),
        confidence=0,
        policy_source=_policy_source_from_policy(policy),
    )


def assess(jurisdiction: str, work_category: str, task_classification: str) -> DiyAssessment:
    """Assess a specific task against a jurisdiction's policy.

    Falls back to a conservative 'unclear' assessment when the jurisdiction is
    unverified or no rule matches the task.
    """
    policy = load_policy(jurisdiction)

    if not policy.verified:
        return baseline_assessment(jurisdiction)

    rule = policy.find_rule(work_category, task_classification)
    if rule is None:
        return DiyAssessment(
            jurisdiction=Jurisdiction(jurisdiction),
            assessment_status=AssessmentStatus.more_information_required,
            legal_status=LegalStatus.unclear,
            safety_status=SafetyStatus.insufficient_information,
            overall_status=OverallStatus.more_information,
            reason=_NO_MATCH_REASON.format(jur=jurisdiction),
            questions_required=[
                "What exact work do you intend to perform?",
                "Please provide a clear close-up and a wider photo of the affected area.",
            ],
            confidence=10,
            policy_source=_policy_source_from_policy(policy),
        )

    safety = rule.safety_status or _default_safety(rule.legal_status, rule.required_professional_type)
    overall = _derive_overall(rule.legal_status, safety, rule.required_professional_type)
    confidence = rule.confidence if rule.confidence is not None else _default_confidence(rule.legal_status)

    regulated = [rule.work_category] if rule.legal_status != LegalStatus.permitted else []

    return DiyAssessment(
        jurisdiction=Jurisdiction(jurisdiction),
        safety_level={
            OverallStatus.safe_diy: SafetyLevel.safe_diy,
            OverallStatus.caution: SafetyLevel.caution,
            OverallStatus.professional_required: SafetyLevel.professional_required,
            OverallStatus.emergency: SafetyLevel.emergency,
        }.get(overall),
        assessment_status=(
            AssessmentStatus.complete
            if overall != OverallStatus.more_information
            else AssessmentStatus.more_information_required
        ),
        legal_status=rule.legal_status,
        safety_status=safety,
        overall_status=overall,
        reason=rule.reason,
        regulated_work_categories=regulated,
        risk_categories=list(rule.risk_categories),
        warning_signs=list(rule.warning_signs),
        questions_required=list(rule.questions_required),
        allowed_actions=list(rule.allowed_actions),
        prohibited_actions=list(rule.prohibited_actions),
        professional_type=rule.required_professional_type,
        confidence=confidence,
        policy_source=_policy_source_from_rule(rule),
    )
