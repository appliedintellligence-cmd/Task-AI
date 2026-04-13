from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from services.supabase import save_job, get_jobs, verify_token

router = APIRouter()


class JobRequest(BaseModel):
    user_id: str
    image_url: Optional[str] = None
    result: dict


@router.post("/jobs")
async def create_job(body: JobRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    job_id = await save_job(
        user_id=body.user_id,
        image_url=body.image_url,
        result=body.result,
    )
    return {"job_id": job_id}


@router.get("/jobs/{user_id}")
async def list_jobs(user_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    authed_user = await verify_token(token)
    if not authed_user or authed_user != user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    jobs = await get_jobs(user_id)
    return jobs
