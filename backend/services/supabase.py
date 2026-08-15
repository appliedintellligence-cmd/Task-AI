import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from supabase import create_client, Client
from dotenv import load_dotenv
from services.embeddings import generate_embedding
from services.job_safety import enforce_job_read_safety

load_dotenv()

_client: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)

BUCKET = "repair-photos-private"
SIGNED_URL_TTL_SECONDS = 300
_PHOTO_PATH = re.compile(
    r"^(?P<user>[0-9a-f-]{36})/(?P<job>[0-9a-f-]{36})/(?P<file>[0-9a-f]{32}\.(?:jpg|jpeg|png|webp))$",
    re.IGNORECASE,
)


def validate_photo_path(path: str, user_id: str, job_id: str) -> str:
    match = _PHOTO_PATH.fullmatch(path or "")
    if not match:
        raise ValueError("Invalid private photo path")
    try:
        expected_user = str(uuid.UUID(user_id))
        expected_job = str(uuid.UUID(job_id))
        actual_user = str(uuid.UUID(match.group("user")))
        actual_job = str(uuid.UUID(match.group("job")))
    except (ValueError, AttributeError) as exc:
        raise ValueError("Invalid private photo path") from exc
    if actual_user != expected_user or actual_job != expected_job:
        raise PermissionError("Photo does not belong to this job and user")
    return path


def is_legacy_public_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username


def _extension(filename: str, content_type: str) -> str:
    allowed = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    if content_type not in allowed:
        raise ValueError("Unsupported image type")
    return allowed[content_type]


def create_photo_path(user_id: str, job_id: str, filename: str, content_type: str) -> str:
    user_id = str(uuid.UUID(user_id))
    job_id = str(uuid.UUID(job_id))
    ext = _extension(filename, content_type)
    return f"{user_id}/{job_id}/{uuid.uuid4().hex}.{ext}"


def create_signed_photo_url(path: str, expires_in: int = SIGNED_URL_TTL_SECONDS) -> dict:
    response = _client.storage.from_(BUCKET).create_signed_url(path, expires_in)
    signed_url = response.get("signedURL") or response.get("signedUrl") or response.get("signed_url")
    if not signed_url:
        raise RuntimeError("Storage did not return a signed URL")
    return {
        "image_url": signed_url,
        "image_url_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat(),
    }


async def upload_private_image(
    user_id: str,
    job_id: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict:
    path = create_photo_path(user_id, job_id, filename, content_type)
    _client.storage.from_(BUCKET).upload(path, file_bytes, {"content-type": content_type})
    return {"photo_path": path, **create_signed_photo_url(path)}


async def save_job(
    user_id: str,
    result: dict,
    job_id: str | None = None,
    photo_path: str | None = None,
    legacy_image_url: str | None = None,
) -> str:
    embedding = generate_embedding(result)
    assessment = result.get("diy_assessment") or {}
    if job_id:
        job_id = str(uuid.UUID(job_id))
    else:
        job_id = str(uuid.uuid4())
    if photo_path:
        validate_photo_path(photo_path, user_id, job_id)
    if legacy_image_url and not is_legacy_public_url(legacy_image_url):
        raise ValueError("Invalid legacy image URL")
    data = {
        "id": job_id,
        "user_id": user_id,
        "image_url": legacy_image_url if not photo_path else None,
        "photo_path": photo_path,
        "photo_storage": "private" if photo_path else "legacy_public",
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


def _hydrate_job_photo(user_id: str, job: dict) -> dict:
    hydrated = dict(job)
    path = hydrated.get("photo_path")
    if path:
        validate_photo_path(path, user_id, str(hydrated["id"]))
        hydrated.update(create_signed_photo_url(path))
    elif not is_legacy_public_url(hydrated.get("image_url")):
        hydrated["image_url"] = None
    return hydrated


async def get_similar_jobs(user_id: str, job_id: str, limit: int = 5) -> list:
    response = _client.rpc(
        "find_similar_jobs_for_user",
        {"source_job_id": job_id, "owner_id": user_id, "match_count": limit},
    ).execute()
    return [_hydrate_job_photo(user_id, enforce_job_read_safety(job)) for job in response.data]


async def get_jobs(user_id: str) -> list:
    response = (
        _client.table("jobs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_hydrate_job_photo(user_id, enforce_job_read_safety(job)) for job in response.data]


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
    return _hydrate_job_photo(user_id, enforce_job_read_safety(response.data[0]))


def get_job_photo_url(user_id: str, job_id: str) -> dict | None:
    job = get_job(user_id, job_id)
    if not job:
        return None
    if job.get("photo_path"):
        return {
            "job_id": job_id,
            "photo_path": job["photo_path"],
            "image_url": job["image_url"],
            "image_url_expires_at": job["image_url_expires_at"],
            "legacy": False,
        }
    if is_legacy_public_url(job.get("image_url")):
        return {"job_id": job_id, "image_url": job["image_url"], "legacy": True}
    return None


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


def delete_account(user_id: str) -> None:
    """Delete all user-owned content before removing the authentication record."""
    bucket = _client.storage.from_(BUCKET)

    def collect_paths(prefix: str) -> list[str]:
        paths = []
        for item in bucket.list(prefix) or []:
            name = item.get("name")
            if not name:
                continue
            path = f"{prefix}/{name}"
            if item.get("id") or item.get("metadata"):
                paths.append(path)
            else:
                paths.extend(collect_paths(path))
        return paths

    # Delete by owner prefix so abandoned uploads are removed as well as saved jobs.
    photo_paths = collect_paths(user_id)
    if photo_paths:
        for start in range(0, len(photo_paths), 100):
            bucket.remove(photo_paths[start:start + 100])

    # Messages cascade from chats. Delete dependent records before auth.users.
    _client.table("chats").delete().eq("user_id", user_id).execute()
    _client.table("jobs").delete().eq("user_id", user_id).execute()
    _client.table("profiles").delete().eq("id", user_id).execute()
    _client.auth.admin.delete_user(user_id)


async def verify_token(token: str) -> str | None:
    try:
        user = _client.auth.get_user(token)
        return user.user.id
    except Exception:
        return None
