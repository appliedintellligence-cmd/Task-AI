import replicate
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class InpaintRequest(BaseModel):
    inpaint_prompt: str

@router.post("/inpaint")
async def inpaint(body: InpaintRequest):
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")
