"""Versioned jurisdiction policy schema.

A `JurisdictionPolicy` is the on-disk (`backend/policies/<CODE>.json`) record of
what is / isn't DIY-permitted in one Australian jurisdiction. Detailed legal
rules are NOT authored from memory — until a jurisdiction has been researched,
its policy ships as an unverified placeholder (`verified=false`, no rules) which
can only ever resolve to `legal_status: unclear`.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from .enums import Jurisdiction, LegalStatus


class PolicyRule(BaseModel):
    """A single DIY legality rule within a jurisdiction."""
    jurisdiction: Jurisdiction
    work_category: str                      # e.g. "electrical", "plumbing", "structural"
    task_classification: str                # e.g. "replace_light_fitting"
    legal_status: LegalStatus
    conditions: list[str] = Field(default_factory=list)   # apply only when these hold
    exclusions: list[str] = Field(default_factory=list)   # rule does NOT cover these
    required_professional_type: Optional[str] = None       # e.g. "licensed electrician"
    source_url: str = ""
    source_regulator: str = ""
    effective_date: Optional[date] = None
    last_reviewed_at: Optional[date] = None
    policy_version: str


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
        # Every rule must belong to this jurisdiction.
        for rule in self.rules:
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
        return self

    def is_placeholder(self) -> bool:
        """True when this is an unresearched placeholder policy."""
        return not self.verified and len(self.rules) == 0
