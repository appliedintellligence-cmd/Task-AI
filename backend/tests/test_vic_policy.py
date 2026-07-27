"""Behavioural tests for the verified Victorian DIY policy.

Covers the required scenarios and the safety-critical invariants:
regulated / hazardous work is never returned as permitted or safe_diy, and
anything unverified or unknown resolves to 'unclear'.
"""

import pytest

from models.enums import LegalStatus, OverallStatus, SafetyStatus
from services.diy_validator import assess
from services.policy_store import load_policy

JUR = "VIC"


def _assess(work_category, task_classification):
    return assess(JUR, work_category, task_classification)


# ── 1. Cosmetic plaster repair ───────────────────────────────────────────────
def test_cosmetic_plaster_repair_permitted_with_structural_caveat():
    a = _assess("cosmetic_finishes", "cosmetic_plaster_repair")
    assert a.legal_status == LegalStatus.permitted
    # Cautioned because a crack can mask structural movement.
    assert a.safety_status == SafetyStatus.caution
    assert a.overall_status == OverallStatus.caution
    # The structural caveat is surfaced to the user as a warning sign.
    assert any("structural" in w.lower() for w in a.warning_signs)


# ── 2. Painting ──────────────────────────────────────────────────────────────
def test_painting_is_safe_diy():
    a = _assess("cosmetic_finishes", "painting")
    assert a.legal_status == LegalStatus.permitted
    assert a.overall_status == OverallStatus.safe_diy
    assert a.professional_type is None


# ── 3. Exposed wiring ────────────────────────────────────────────────────────
def test_exposed_wiring_requires_electrician():
    a = _assess("electrical", "repair_exposed_wiring")
    assert a.legal_status == LegalStatus.licensed_trade_required
    assert a.overall_status == OverallStatus.professional_required
    assert "electrician" in (a.professional_type or "").lower()
    assert len(a.warning_signs) > 0
    assert a.legal_status != LegalStatus.permitted


# ── 4. Replacing a fixed power point ─────────────────────────────────────────
def test_replace_power_point_requires_electrician():
    a = _assess("electrical", "replace_power_point")
    assert a.legal_status == LegalStatus.licensed_trade_required
    assert "electrician" in (a.professional_type or "").lower()
    assert a.overall_status == OverallStatus.professional_required


# ── 5. Gas-line / gas-appliance connection ───────────────────────────────────
@pytest.mark.parametrize("task", ["connect_gas_appliance", "gas_pipework"])
def test_gas_work_requires_gasfitter(task):
    a = _assess("gasfitting", task)
    assert a.legal_status == LegalStatus.licensed_trade_required
    assert "gasfitter" in (a.professional_type or "").lower()
    assert a.overall_status == OverallStatus.professional_required


# ── 6. Minor water-related maintenance (ambiguous → unclear) ─────────────────
def test_minor_water_maintenance_is_unclear_not_permitted():
    a = _assess("plumbing", "minor_water_maintenance")
    assert a.legal_status == LegalStatus.unclear
    assert a.legal_status != LegalStatus.permitted
    assert a.overall_status != OverallStatus.safe_diy
    assert len(a.questions_required) > 0


# ── 7. Regulated plumbing ────────────────────────────────────────────────────
@pytest.mark.parametrize("wc,task", [
    ("plumbing_water_supply", "water_supply_work"),
    ("plumbing_sanitary", "sanitary_work"),
    ("plumbing_drainage", "sewerage_drainage_work"),
    ("plumbing_roofing_stormwater", "roof_plumbing_stormwater_work"),
    ("plumbing_backflow", "backflow_prevention_work"),
])
def test_regulated_plumbing_requires_licensed_plumber(wc, task):
    a = _assess(wc, task)
    assert a.legal_status == LegalStatus.licensed_trade_required
    assert "plumber" in (a.professional_type or "").lower()
    assert a.overall_status == OverallStatus.professional_required


# ── 8. Structural cracking ───────────────────────────────────────────────────
def test_structural_crack_requires_building_practitioner():
    a = _assess("structural", "repair_structural_crack")
    assert a.legal_status == LegalStatus.licensed_trade_required
    assert a.overall_status == OverallStatus.professional_required
    assert a.professional_type is not None
    assert a.legal_status != LegalStatus.permitted


# ── 9. Suspected asbestos ────────────────────────────────────────────────────
def test_suspected_asbestos_is_unclear_and_escalates():
    a = _assess("hazardous_material", "suspected_asbestos")
    # Suspected (unconfirmed) material -> never permitted.
    assert a.legal_status == LegalStatus.unclear
    assert a.legal_status != LegalStatus.permitted
    assert a.overall_status == OverallStatus.professional_required
    assert "removalist" in (a.professional_type or "").lower()
    assert len(a.warning_signs) > 0
    assert len(a.questions_required) > 0


# ── 10. Unknown building material ────────────────────────────────────────────
def test_unknown_material_needs_more_information():
    a = _assess("unknown", "unknown_material")
    assert a.legal_status == LegalStatus.unclear
    assert a.safety_status == SafetyStatus.insufficient_information
    assert a.overall_status == OverallStatus.more_information
    assert len(a.questions_required) > 0


# ── Invariants ───────────────────────────────────────────────────────────────

REGULATED_OR_HAZARD = [
    ("electrical", "fixed_electrical_work"),
    ("electrical", "replace_power_point"),
    ("electrical", "replace_light_switch"),
    ("electrical", "connect_fixed_appliance"),
    ("electrical", "repair_exposed_wiring"),
    ("gasfitting", "connect_gas_appliance"),
    ("gasfitting", "gas_pipework"),
    ("plumbing_water_supply", "water_supply_work"),
    ("plumbing_sanitary", "sanitary_work"),
    ("plumbing_drainage", "sewerage_drainage_work"),
    ("plumbing_roofing_stormwater", "roof_plumbing_stormwater_work"),
    ("plumbing_backflow", "backflow_prevention_work"),
    ("structural", "structural_building_work"),
    ("structural", "repair_structural_crack"),
    ("hazardous_material", "suspected_asbestos"),
]


@pytest.mark.parametrize("wc,task", REGULATED_OR_HAZARD)
def test_regulated_or_hazard_never_safe_diy(wc, task):
    a = _assess(wc, task)
    assert a.legal_status != LegalStatus.permitted
    assert a.overall_status != OverallStatus.safe_diy
    assert a.safety_status != SafetyStatus.suitable


def test_unmatched_task_defaults_to_unclear():
    a = _assess("electrical", "this_task_does_not_exist")
    assert a.legal_status == LegalStatus.unclear
    assert a.overall_status != OverallStatus.safe_diy


def test_every_definite_vic_rule_cites_a_source():
    policy = load_policy("VIC")
    for rule in policy.rules:
        if rule.legal_status != LegalStatus.unclear:
            assert rule.source_url, f"{rule.task_classification} missing source_url"
            assert rule.source_regulator, f"{rule.task_classification} missing source_regulator"
        assert rule.last_reviewed_at is not None
        assert rule.policy_version


def test_no_vic_permitted_rule_covers_regulated_trades():
    policy = load_policy("VIC")
    permitted = [r for r in policy.rules if r.legal_status == LegalStatus.permitted]
    for r in permitted:
        assert r.work_category == "cosmetic_finishes"
