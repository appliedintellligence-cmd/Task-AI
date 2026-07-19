"""Schema-validation tests for the shipped jurisdiction policy files."""

import pytest
from pydantic import ValidationError

from models.enums import Jurisdiction, LegalStatus
from models.policy import JurisdictionPolicy, PolicyRule
from services.policy_store import (
    JURISDICTIONS,
    load_all_policies,
    load_policy,
    policy_path,
)

ALL_CODES = [j.value for j in Jurisdiction]
EXPECTED_CODES = {"ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"}

# VIC has been researched and verified; the rest remain placeholders for now.
VERIFIED_CODES = {"VIC"}
UNVERIFIED_CODES = sorted(EXPECTED_CODES - VERIFIED_CODES)


def test_all_eight_jurisdictions_covered():
    assert set(ALL_CODES) == EXPECTED_CODES
    assert set(JURISDICTIONS) == EXPECTED_CODES


@pytest.mark.parametrize("code", ALL_CODES)
def test_policy_file_exists(code):
    assert policy_path(code).exists(), f"missing policy file for {code}"


@pytest.mark.parametrize("code", ALL_CODES)
def test_policy_loads_and_validates(code):
    policy = load_policy(code)
    assert isinstance(policy, JurisdictionPolicy)
    assert policy.jurisdiction.value == code
    assert policy.policy_version, "policy_version must be non-empty"


@pytest.mark.parametrize("code", UNVERIFIED_CODES)
def test_unresearched_jurisdictions_are_placeholders(code):
    policy = load_policy(code)
    assert policy.verified is False
    assert policy.is_placeholder() is True
    assert policy.rules == []


def test_vic_is_verified_and_populated():
    policy = load_policy("VIC")
    assert policy.verified is True
    assert policy.is_placeholder() is False
    assert len(policy.rules) > 0


@pytest.mark.parametrize("code", ALL_CODES)
def test_no_unverified_policy_asserts_permitted(code):
    policy = load_policy(code)
    if not policy.verified:
        assert all(r.legal_status != LegalStatus.permitted for r in policy.rules)


def test_load_all_policies_returns_all_eight():
    policies = load_all_policies()
    assert set(policies.keys()) == EXPECTED_CODES


def test_missing_policy_raises():
    with pytest.raises((FileNotFoundError, ValueError)):
        load_policy("XYZ")


def test_schema_rejects_unverified_permitted_rule():
    """An unverified policy containing a 'permitted' rule must fail validation."""
    with pytest.raises(ValidationError):
        JurisdictionPolicy(
            jurisdiction=Jurisdiction.VIC,
            policy_version="test",
            verified=False,
            rules=[
                PolicyRule(
                    jurisdiction=Jurisdiction.VIC,
                    work_category="painting",
                    task_classification="paint_interior_wall",
                    legal_status=LegalStatus.permitted,
                    policy_version="test",
                )
            ],
        )


def test_schema_rejects_rule_jurisdiction_mismatch():
    with pytest.raises(ValidationError):
        JurisdictionPolicy(
            jurisdiction=Jurisdiction.VIC,
            policy_version="test",
            verified=True,
            rules=[
                PolicyRule(
                    jurisdiction=Jurisdiction.NSW,  # mismatch
                    work_category="painting",
                    task_classification="paint_interior_wall",
                    legal_status=LegalStatus.unclear,
                    policy_version="test",
                )
            ],
        )


def test_schema_rejects_invalid_enum_values():
    with pytest.raises(ValidationError):
        JurisdictionPolicy(
            jurisdiction="ZZZ",  # not a valid Jurisdiction
            policy_version="test",
        )


def test_verified_policy_may_contain_permitted_rule():
    """The 'no permitted' guard applies only to unverified policies.

    A verified permitted rule is allowed, but must cite a source.
    """
    policy = JurisdictionPolicy(
        jurisdiction=Jurisdiction.VIC,
        policy_version="test",
        verified=True,
        rules=[
            PolicyRule(
                jurisdiction=Jurisdiction.VIC,
                work_category="cosmetic_finishes",
                task_classification="paint_interior_wall",
                legal_status=LegalStatus.permitted,
                source_url="https://www.example.vic.gov.au/",
                source_regulator="Test regulator",
                policy_version="test",
            )
        ],
    )
    assert policy.verified is True
    assert policy.is_placeholder() is False


def test_verified_definite_rule_requires_source():
    """A verified permitted/licensed rule without a source must fail validation."""
    with pytest.raises(ValidationError):
        JurisdictionPolicy(
            jurisdiction=Jurisdiction.VIC,
            policy_version="test",
            verified=True,
            rules=[
                PolicyRule(
                    jurisdiction=Jurisdiction.VIC,
                    work_category="electrical",
                    task_classification="replace_power_point",
                    legal_status=LegalStatus.licensed_trade_required,
                    policy_version="test",  # no source_url / source_regulator
                )
            ],
        )
