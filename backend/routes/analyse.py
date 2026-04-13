from fastapi import APIRouter, UploadFile, File, HTTPException
from services.gemini import analyse_image
from services.supabase import upload_image

router = APIRouter()


@router.post("/analyse")
async def analyse(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    # Upload to Supabase Storage
    filename = file.filename or "upload.jpg"
    image_url = await upload_image(image_bytes, filename)

    # Analyse with Gemini
    result = await analyse_image(image_bytes)
    result["image_url"] = image_url

    return result
