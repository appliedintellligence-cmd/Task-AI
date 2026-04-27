import os
import uuid
from datetime import datetime, timezone
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


def create_chat(user_id: str, title: str) -> str:
    res = _client.table("chats").insert({"user_id": user_id, "title": title}).execute()
    return res.data[0]["id"]


def save_message(
    chat_id: str,
    role: str,
    content: str = None,
    image_url: str = None,
    result_json: dict = None,
    embedding: list[float] = None,
) -> str:
    row = {
        "chat_id": chat_id, "role": role,
        "content": content, "image_url": image_url, "result_json": result_json,
    }
    if embedding is not None:
        row["embedding"] = embedding
    res = _client.table("messages").insert(row).execute()
    _client.table("chats").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", chat_id).execute()
    return res.data[0]["id"]


def call_match_messages_rpc(
    embedding: list[float],
    match_threshold: float = 0.6,
    match_count: int = 5,
) -> list[dict]:
    response = _client.rpc(
        "match_messages",
        {
            "query_embedding": embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
        },
    ).execute()
    return response.data or []


def get_messages(chat_id: str) -> list:
    return _client.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute().data


def get_chats(user_id: str) -> list:
    return _client.table("chats").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute().data


def delete_chat(chat_id: str) -> None:
    _client.table("chats").delete().eq("id", chat_id).execute()


async def verify_token(token: str) -> str | None:
    try:
        user = _client.auth.get_user(token)
        return user.user.id
    except Exception:
        return None
