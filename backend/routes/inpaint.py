import replicate
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies import authenticated_user
from services.supabase import get_job, validate_photo_path

router = APIRouter()

class InpaintRequest(BaseModel):
    inpaint_prompt: str = Field(min_length=1, max_length=4000)
    job_id: UUID | None = None
    photo_path: str | None = None


def _authorize_references(body: InpaintRequest, user_id: str) -> None:
    if body.photo_path and not body.job_id:
        raise HTTPException(status_code=422, detail="job_id is required with photo_path")

    if body.photo_path and body.job_id:
        job_id = str(body.job_id)
        try:
            validate_photo_path(body.photo_path, user_id, job_id)
        except (ValueError, PermissionError) as exc:
            raise HTTPException(status_code=404, detail="Repair resource not found") from exc

    if not body.job_id:
        return

    job = get_job(user_id, str(body.job_id))
    if job:
        if body.photo_path and job.get("photo_path") != body.photo_path:
            raise HTTPException(status_code=404, detail="Repair resource not found")
        return

    # An analysis photo is uploaded before its job row is saved. Its validated
    # private path is sufficient ownership proof for that short-lived state.
    if not body.photo_path:
        raise HTTPException(status_code=404, detail="Repair resource not found")

@router.post("/inpaint")
async def inpaint(
    body: InpaintRequest,
    user_id: str = Depends(authenticated_user),
):
    _authorize_references(body, user_id)
    try:
        output = await replicate.async_run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": body.inpaint_prompt,
                "num_outputs": 1,
                "aspect_ratio": "1:1",
                "output_format": "webp",
                "num_inference_steps": 4,
            }
        )
        return {"repaired_image_url": str(output[0])}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Image generation failed") from exc
