from pathlib import Path

from models.enums import Jurisdiction
from services.job_safety import enforce_job_read_safety


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "db" / "migrations" / "20260718_add_profile_jurisdiction.sql"


def test_profile_migration_supports_exactly_backend_jurisdictions():
    sql = MIGRATION.read_text()
    for code in Jurisdiction:
        assert f"'{code.value}'" in sql
    assert "ADD COLUMN IF NOT EXISTS jurisdiction" in sql
    assert "jurisdiction IS NULL" in sql


def test_existing_profile_rows_are_preserved_as_missing_jurisdiction():
    sql = MIGRATION.read_text()
    assert "UPDATE profiles" not in sql
    assert "NOT NULL" not in sql


def test_historical_job_keeps_original_jurisdiction():
    job = {
        "jurisdiction": "VIC",
        "result_json": {
            "diy_assessment": {"jurisdiction": "VIC", "validation_version": "2.0"},
            "steps": [],
        },
    }
    assert enforce_job_read_safety(job)["result_json"]["diy_assessment"]["jurisdiction"] == "VIC"
