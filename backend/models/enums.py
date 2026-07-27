"""Controlled vocabularies for DIY validation.

Three decisions are kept deliberately separate:

  * LegalStatus  — is the work legally permitted for an unlicensed person?
  * SafetyStatus — does this particular situation look suitable for DIY?
  * OverallStatus — the combined, user-facing verdict.

Product approval/registration is a fourth, independent decision handled on the
material/product records, not encoded here.
"""

from enum import Enum, IntEnum


class SafetyLevel(IntEnum):
    safe_diy = 1
    caution = 2
    professional_required = 3
    emergency = 4


class AssessmentStatus(str, Enum):
    complete = "complete"
    assessment_pending = "assessment_pending"
    more_information_required = "more_information_required"
    jurisdiction_required = "jurisdiction_required"
    policy_unverified = "policy_unverified"


class Jurisdiction(str, Enum):
    """Australian states and territories."""
    ACT = "ACT"
    NSW = "NSW"
    NT = "NT"
    QLD = "QLD"
    SA = "SA"
    TAS = "TAS"
    VIC = "VIC"
    WA = "WA"


class LegalStatus(str, Enum):
    """Whether the work is legally permitted for an unlicensed person.

    `unclear` is the safe default: it is used whenever the jurisdiction's rules
    are unverified or no matching rule is found. It must never be upgraded to
    `permitted` without a verified policy rule.
    """
    permitted = "permitted"
    licensed_trade_required = "licensed_trade_required"
    unclear = "unclear"


class SafetyStatus(str, Enum):
    """Whether the particular situation appears suitable for DIY."""
    suitable = "suitable"
    caution = "caution"
    unsuitable = "unsuitable"
    emergency = "emergency"
    insufficient_information = "insufficient_information"


class OverallStatus(str, Enum):
    """Combined user-facing verdict derived from legal + safety status."""
    safe_diy = "safe_diy"
    caution = "caution"
    more_information = "more_information"
    professional_required = "professional_required"
    emergency = "emergency"
