"""Structured data models for Task AI.

Currently houses the jurisdiction-aware Australian DIY validation models.
These are additive — the existing `/analyse`, `/chat`, `/jobs` and `/inpaint`
responses are unchanged and remain backward-compatible.
"""

from .enums import (
    AssessmentStatus,
    Jurisdiction,
    LegalStatus,
    SafetyLevel,
    SafetyStatus,
    OverallStatus,
)
from .diy_assessment import DiyAssessment, PolicySource, VALIDATION_VERSION
from .policy import PolicyRule, JurisdictionPolicy

__all__ = [
    "AssessmentStatus",
    "Jurisdiction",
    "LegalStatus",
    "SafetyLevel",
    "SafetyStatus",
    "OverallStatus",
    "DiyAssessment",
    "PolicySource",
    "VALIDATION_VERSION",
    "PolicyRule",
    "JurisdictionPolicy",
]
