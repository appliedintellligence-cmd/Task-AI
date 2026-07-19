import os
import uuid
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv
from services.embeddings import generate_embedding
from services.job_safety import enforce_job_read_safety

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
    assessment = result.get("diy_assessment") or {}
    data = {
        "user_id": user_id,
        "image_url": image_url,
        "problem": result.get("problem"),
        "severity": result.get("severity"),
        "difficulty": result.get("difficulty"),
        "result_json": result,
        "jurisdiction": assessment.get("jurisdiction"),
        "safety_level": assessment.get("safety_level"),
        "assessment_status": assessment.get("assessment_status", "assessment_pending"),
        "legal_status": assessment.get("legal_status", "unclear"),
        "safety_status": assessment.get("safety_status", "insufficient_information"),
        "overall_status": assessment.get("overall_status", "more_information"),
        "policy_version": (assessment.get("policy_source") or {}).get("policy_version", ""),
        "validation_version": assessment.get("validation_version", ""),
        "policy_sources": [assessment.get("policy_source")] if assessment.get("policy_source") else [],
        "assessed_at": assessment.get("assessed_at"),
    }
    if embedding is not None:
        data["embedding"] = embedding
    response = _client.table("jobs").insert(data).execute()
    return response.data[0]["id"]


async def get_similar_jobs(user_id: str, job_id: str, limit: int = 5) -> list:
    response = _client.rpc(
        "find_similar_jobs_for_user",
        {"source_job_id": job_id, "owner_id": user_id, "match_count": limit},
    ).execute()
    return [enforce_job_read_safety(job) for job in response.data]


async def get_jobs(user_id: str) -> list:
    response = (
        _client.table("jobs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [enforce_job_read_safety(job) for job in response.data]


def create_chat(user_id: str, title: str) -> str:
    res = _client.table("chats").insert({"user_id": user_id, "title": title}).execute()
    return res.data[0]["id"]


def save_message(
    user_id: str,
    chat_id: str,
    role: str,
    content: str = None,
    image_url: str = None,
    result_json: dict = None,
    embedding: list[float] = None,
) -> str:
    if not owns_chat(user_id, chat_id):
        raise LookupError("Chat not found")
    row = {
        "chat_id": chat_id, "role": role,
        "content": content, "image_url": image_url, "result_json": result_json,
    }
    if embedding is not None:
        row["embedding"] = embedding
    res = _client.table("messages").insert(row).execute()
    (
        _client.table("chats")
        .update({"updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0]["id"]


def call_match_messages_rpc(
    user_id: str,
    embedding: list[float],
    match_threshold: float = 0.6,
    match_count: int = 5,
) -> list[dict]:
    response = _client.rpc(
        "match_messages_for_user",
        {
            "owner_id": user_id,
            "query_embedding": embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
        },
    ).execute()
    return response.data or []


def owns_chat(user_id: str, chat_id: str) -> bool:
    response = (
        _client.table("chats")
        .select("id")
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def get_messages(user_id: str, chat_id: str) -> list:
    if not owns_chat(user_id, chat_id):
        return []
    return _client.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute().data


def get_job(user_id: str, job_id: str) -> dict | None:
    response = (
        _client.table("jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return enforce_job_read_safety(response.data[0])


def get_chats(user_id: str) -> list:
    return _client.table("chats").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute().data


def delete_chat(user_id: str, chat_id: str) -> bool:
    response = (
        _client.table("chats")
        .delete()
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(response.data)


async def verify_token(token: str) -> str | None:
    try:
        user = _client.auth.get_user(token)
        return user.user.id
    except Exception:
        return None
