"""Load and validate versioned jurisdiction policy files.

Policy files live in ``backend/policies/<CODE>.json`` and are validated against
the ``JurisdictionPolicy`` schema on load, so a malformed or unsafe policy
(e.g. an unverified file asserting 'permitted') fails fast.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from models.enums import Jurisdiction
from models.policy import JurisdictionPolicy

POLICY_DIR = Path(__file__).resolve().parent.parent / "policies"

# Canonical ordering of the jurisdictions we ship policy files for.
JURISDICTIONS: list[str] = [j.value for j in Jurisdiction]


def policy_path(jurisdiction: str) -> Path:
    return POLICY_DIR / f"{jurisdiction}.json"


def load_policy(jurisdiction: str) -> JurisdictionPolicy:
    """Load and schema-validate a single jurisdiction's policy."""
    path = policy_path(jurisdiction)
    if not path.exists():
        raise FileNotFoundError(
            f"No policy file for jurisdiction '{jurisdiction}' (expected {path})"
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    policy = JurisdictionPolicy.model_validate(data)
    if policy.jurisdiction.value != jurisdiction:
        raise ValueError(
            f"Policy file {path.name} declares jurisdiction "
            f"'{policy.jurisdiction.value}' but filename is '{jurisdiction}'"
        )
    return policy


@lru_cache(maxsize=1)
def load_all_policies() -> dict[str, JurisdictionPolicy]:
    """Load every shipped jurisdiction policy, keyed by code."""
    return {code: load_policy(code) for code in JURISDICTIONS}
