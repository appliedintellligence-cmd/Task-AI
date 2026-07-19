from services.job_safety import enforce_job_read_safety, validate_result_for_save


def test_direct_save_cannot_preserve_policy_prohibited_steps():
    result = {
        "surface_material": "copper wire",
        "problem": "Replace exposed fixed wiring",
        "steps": [{"description": "Splice and repair the exposed wiring"}],
        "materials": [{"name": "connector"}],
        "tools_required": ["pliers"],
        "diy_classification": {"work_category": "electrical", "task_classification": "repair_exposed_wiring"},
        "diy_assessment": {"jurisdiction": "VIC"},
    }
    safe = validate_result_for_save(result)
    assert safe["diy_assessment"]["safety_level"] == 3
    assert safe["steps"] == []
    assert safe["materials"] == []


def test_historical_job_requires_reassessment_and_has_no_instructions():
    old = {"id": "old", "result_json": {"steps": [{"description": "old unsafe step"}], "materials": ["x"]}}
    safe = enforce_job_read_safety(old)
    assert safe["result_json"]["requires_reassessment"] is True
    assert safe["result_json"]["diy_assessment"]["assessment_status"] == "assessment_pending"
    assert safe["result_json"]["steps"] == []


def test_saved_result_reuses_clarification_context_during_server_reassessment():
    result = {
        "surface_material": "plaster",
        "damage_types": ["dent"],
        "problem": "Small plaster dent",
        "steps": [{"description": "Fill the small dent"}],
        "materials": [],
        "tools_required": [],
        "diy_classification": {"work_category": "cosmetic_finishes", "task_classification": "cosmetic_plaster_repair"},
        "diy_assessment": {"jurisdiction": "VIC"},
        "assessment_context": {
            "jurisdiction": "VIC",
            "user_answers": {"building_age": "2005", "asbestos_possible": False, "crack_width_mm": 0},
        },
    }
    safe = validate_result_for_save(result)
    assert safe["diy_assessment"]["safety_level"] == 1
    assert safe["steps"]
