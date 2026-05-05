import logging

logger = logging.getLogger(__name__)

REQUIRED_FACTS = [
    "surface_material",
    "damage_visible",
    "damage_types"
]

REQUIRED_PLAN = [
    "confidence",
    "problem",
    "severity",
    "steps",
    "materials",
    "tools_required"
]


def validate_facts(facts: dict) -> tuple[bool, str]:
    for field in REQUIRED_FACTS:
        if field not in facts:
            return False, f"Missing: {field}"
    return True, "ok"


def validate_plan(plan: dict) -> tuple[bool, str]:
    for field in REQUIRED_PLAN:
        if field not in plan:
            return False, f"Missing: {field}"
    if not isinstance(plan["steps"], list):
        return False, "steps not a list"
    if len(plan["steps"]) == 0:
        return False, "steps is empty"
    if not isinstance(plan["materials"], list):
        return False, "materials not a list"
    return True, "ok"


def confidence_level(score: int) -> str:
    if score >= 80:
        return "high"
    elif score >= 60:
        return "medium"
    return "low"
