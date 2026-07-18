"""Build a conservative DIY assessment from stored jurisdiction policy.

This is the data-foundation entry point. It intentionally does NOT yet consume
the vision/repair-plan output or drive any UI — it establishes the mapping from
a validated policy to a ``DiyAssessment`` and guarantees the safety-critical
default: an unverified jurisdiction always resolves to ``legal_status: unclear``.
"""

from __future__ import annotations

from models.diy_assessment import DiyAssessment, PolicySource
from models.enums import Jurisdiction, LegalStatus, OverallStatus, SafetyStatus
from models.policy import JurisdictionPolicy
from services.policy_store import load_policy

_UNVERIFIED_REASON = (
    "DIY legality for this jurisdiction has not yet been verified. Confirm the "
    "specific work with the relevant state or territory regulator, or engage a "
    "licensed professional, before proceeding."
)

_UNVERIFIED_QUESTIONS = [
    "Which Australian state or territory is the property in?",
    "What type of work is involved (e.g. electrical, plumbing, gas, structural)?",
]


def _policy_source(policy: JurisdictionPolicy) -> PolicySource:
    return PolicySource(
        regulator=policy.regulator,
        url=policy.source_url,
        effective_date=policy.effective_date,
        last_reviewed_at=policy.last_reviewed_at.isoformat() if policy.last_reviewed_at else "",
        policy_version=policy.policy_version,
    )


def baseline_assessment(jurisdiction: str) -> DiyAssessment:
    """Return the conservative baseline assessment for a jurisdiction.

    For an unverified/placeholder policy this is always:
      legal_status=unclear, safety_status=insufficient_information,
      overall_status=more_information, confidence=0.

    Verified rule resolution is deliberately out of scope for this phase; until
    a policy is verified it can only ever produce an 'unclear' legal status.
    """
    policy = load_policy(jurisdiction)
    source = _policy_source(policy)

    if not policy.verified:
        return DiyAssessment(
            jurisdiction=Jurisdiction(jurisdiction),
            legal_status=LegalStatus.unclear,
            safety_status=SafetyStatus.insufficient_information,
            overall_status=OverallStatus.more_information,
            reason=_UNVERIFIED_REASON,
            questions_required=list(_UNVERIFIED_QUESTIONS),
            confidence=0,
            policy_source=source,
        )

    # Placeholder for the future verified path. No verified policies exist yet,
    # so we still return the safe 'unclear' default rather than guessing.
    return DiyAssessment(
        jurisdiction=Jurisdiction(jurisdiction),
        legal_status=LegalStatus.unclear,
        safety_status=SafetyStatus.insufficient_information,
        overall_status=OverallStatus.more_information,
        reason="No matching verified rule; defaulting to unclear.",
        confidence=0,
        policy_source=source,
    )
