import os
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv
from services.embeddings import generate_embedding

load_dotenv()

_client: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)

BUCKET = "repair-photos"


async def upload_image(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    path = f"{uuid.uuid4()}.{ext}"
    _client.storage.from_(BUCKET).upload(path, file_bytes, {"content-type": "image/jpeg"})
    public_url = _client.storage.from_(BUCKET).get_public_url(path)
    return public_url


async def save_job(user_id: str, image_url: str, result: dict) -> str:
    embedding = generate_embedding(result)
    data = {
        "user_id": user_id,
        "image_url": image_url,
        "problem": result.get("problem"),
        "severity": result.get("severity"),
        "difficulty": result.get("difficulty"),
        "result_json": result,
        "embedding": embedding,
    }
    response = _client.table("jobs").insert(data).execute()
    return response.data[0]["id"]


async def get_similar_jobs(job_id: str, limit: int = 5) -> list:
    response = _client.rpc(
        "find_similar_jobs", {"job_id": job_id, "match_count": limit}
    ).execute()
    return response.data


async def get_jobs(user_id: str) -> list:
    response = (
        _client.table("jobs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


async def verify_token(token: str) -> str | None:
    try:
        user = _client.auth.get_user(token)
        return user.user.id
    except Exception:
        return None
