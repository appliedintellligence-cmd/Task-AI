"""Versioned jurisdiction policy schema.

A `JurisdictionPolicy` is the on-disk (`backend/policies/<CODE>.json`) record of
what is / isn't DIY-permitted in one Australian jurisdiction. Detailed legal
rules are NOT authored from memory — a jurisdiction is only marked
``verified=true`` once each rule is backed by a cited official regulator source.
Until researched, a jurisdiction ships as an unverified placeholder
(``verified=false``, no rules) which can only ever resolve to
``legal_status: unclear``.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from .enums import Jurisdiction, LegalStatus, SafetyStatus


class PolicyRule(BaseModel):
    """A single DIY legality rule within a jurisdiction.

    The advisory fields (reason, safety_status, risk/warning/question/action
    lists, confidence) let a rule fully describe the assessment it should
    produce; they default to empty/None so existing minimal rules stay valid.
    """
    jurisdiction: Jurisdiction
    work_category: str                      # e.g. "electrical", "plumbing_water_supply"
    task_classification: str                # e.g. "replace_power_point"
    legal_status: LegalStatus

    conditions: list[str] = Field(default_factory=list)   # apply only when these hold
    exclusions: list[str] = Field(default_factory=list)   # rule does NOT cover these
    required_professional_type: Optional[str] = None       # e.g. "Licensed electrician"

    # Provenance (required for a verified rule; see JurisdictionPolicy validator).
    source_url: str = ""
    source_regulator: str = ""
    effective_date: Optional[date] = None
    last_reviewed_at: Optional[date] = None
    policy_version: str

    # Advisory content surfaced in the DiyAssessment.
    reason: str = ""
    safety_status: Optional[SafetyStatus] = None
    confidence: Optional[int] = None
    risk_categories: list[str] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)
    questions_required: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)
    prohibited_actions: list[str] = Field(default_factory=list)


class JurisdictionPolicy(BaseModel):
    """All DIY policy rules for one Australian state/territory."""
    jurisdiction: Jurisdiction
    policy_version: str
    verified: bool = False
    regulator: str = ""
    source_url: str = ""
    effective_date: Optional[date] = None
    last_reviewed_at: Optional[date] = None
    notes: str = ""
    rules: list[PolicyRule] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_consistency(self) -> "JurisdictionPolicy":
        for rule in self.rules:
            # Every rule must belong to this jurisdiction.
            if rule.jurisdiction != self.jurisdiction:
                raise ValueError(
                    f"Rule jurisdiction '{rule.jurisdiction.value}' does not match "
                    f"policy jurisdiction '{self.jurisdiction.value}'"
                )

        # An unverified policy may never assert that work is permitted.
        if not self.verified:
            offending = [r for r in self.rules if r.legal_status == LegalStatus.permitted]
            if offending:
                raise ValueError(
                    "Unverified policy must not contain any 'permitted' rule; "
                    "unverified jurisdictions can only resolve to 'unclear'."
                )

        # Any rule making a DEFINITE legal claim (permitted or
        # licensed_trade_required) in a verified policy must cite an official
        # source and regulator. 'unclear' is the safe default and needs none.
        if self.verified:
            for rule in self.rules:
                if rule.legal_status == LegalStatus.unclear:
                    continue
                if not rule.source_url or not rule.source_regulator:
                    raise ValueError(
                        f"Verified rule '{rule.work_category}/{rule.task_classification}' "
                        f"asserts '{rule.legal_status.value}' but is missing "
                        "source_url or source_regulator."
                    )
        return self

    def is_placeholder(self) -> bool:
        """True when this is an unresearched placeholder policy."""
        return not self.verified and len(self.rules) == 0

    def find_rule(self, work_category: str, task_classification: str) -> Optional[PolicyRule]:
        """Exact-match lookup for a rule; returns None when nothing matches."""
        for rule in self.rules:
            if rule.work_category == work_category and rule.task_classification == task_classification:
                return rule
        return None
