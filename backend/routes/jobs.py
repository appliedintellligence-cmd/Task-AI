from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from dependencies import authenticated_user
from services.supabase import save_job, get_job, get_jobs, get_similar_jobs
from services.job_safety import validate_result_for_save

router = APIRouter()


class JobRequest(BaseModel):
    user_id: Optional[str] = None
    image_url: Optional[str] = None
    result: dict


class VerifyAssessmentRequest(BaseModel):
    result: dict
    changed_conditions: dict = Field(default_factory=dict)


@router.post("/jobs")
async def create_job(body: JobRequest, user_id: str = Depends(authenticated_user)):
    try:
        safe_result = validate_result_for_save(body.result)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail="Saved result could not be safety-validated") from exc

    job_id = await save_job(
        user_id=user_id,
        image_url=body.image_url,
        result=safe_result,
    )
    return {"job_id": job_id}


@router.get("/jobs")
async def list_own_jobs(user_id: str = Depends(authenticated_user)):
    jobs = await get_jobs(user_id)
    return jobs


@router.get("/jobs/{claimed_user_id}")
async def list_jobs(claimed_user_id: str, user_id: str = Depends(authenticated_user)):
    # Backwards-compatible route: the path claim is deliberately ignored.
    jobs = await get_jobs(user_id)
    return jobs


@router.get("/similar/{job_id}")
async def similar_jobs(job_id: str, user_id: str = Depends(authenticated_user)):
    if not get_job(user_id, job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    jobs = await get_similar_jobs(user_id, job_id)
    return jobs


@router.post("/assessments/verify")
async def verify_assessment(body: VerifyAssessmentRequest, user_id: str = Depends(authenticated_user)):
    candidate = dict(body.result)
    context = dict(candidate.get("assessment_context") or {})
    answers = dict(context.get("user_answers") or {})
    answers.update({key: value for key, value in body.changed_conditions.items() if value is True})
    context["user_answers"] = answers
    candidate["assessment_context"] = context
    try:
        return validate_result_for_save(candidate)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail="Assessment could not be verified") from exc
