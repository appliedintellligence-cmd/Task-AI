import re
import json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from services.supabase import (
    create_chat, save_message, get_messages, get_chats, delete_chat, verify_token,
)
from services.gemini import chat_reply
from services.rag import embed_text, search_similar, build_context
from services.retailers import generate_links

router = APIRouter()

# Similarity thresholds
_CACHE_HIT = 0.8   # return past answer directly
_CONTEXT_MIN = 0.6  # inject as context


def _extract_materials(text: str) -> tuple[str, list[dict]]:
    """Parse <materials>[...]</materials> from LLM reply.
    Returns (clean_text, materials_with_links)."""
    match = re.search(r'<materials>(.*?)</materials>', text, re.DOTALL)
    if not match:
        return text, []

    clean = re.sub(r'\s*<materials>.*?</materials>', '', text, flags=re.DOTALL).strip()
    try:
        raw = json.loads(match.group(1).strip())
    except (json.JSONDecodeError, ValueError):
        return clean, []

    materials = []
    for m in raw:
        if isinstance(m, dict) and m.get("name"):
            m["links"] = generate_links(m["name"])
            materials.append(m)

    return clean, materials


class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: str
    user_id: Optional[str] = None


@router.post("/chat")
async def send_message(body: ChatRequest, authorization: Optional[str] = Header(None)):
    user_id = None
    if authorization:
        token = authorization.replace("Bearer ", "")
        user_id = await verify_token(token)

    chat_id = body.chat_id
    if not chat_id and user_id:
        chat_id = create_chat(user_id, body.message[:40])

    # Embed the user message for RAG
    query_embedding = embed_text(body.message)

    # Search for similar past assistant messages
    similar = search_similar(query_embedding, threshold=_CONTEXT_MIN, limit=5)

    raw_reply: str
    top_similarity = similar[0].get("similarity", 0) if similar else 0

    if top_similarity >= _CACHE_HIT:
        # Cache hit — return the stored answer directly without calling LLM
        raw_reply = similar[0].get("content") or ""
        cached = True
    else:
        # Save user message before calling LLM
        if chat_id:
            save_message(chat_id, "user", content=body.message)

        # Build conversation history for context
        history = []
        if chat_id:
            past = get_messages(chat_id)
            for m in past[:-1]:  # exclude the just-saved user message
                if m.get("content"):
                    history.append({"role": m["role"], "content": m["content"]})

        if _CONTEXT_MIN <= top_similarity < _CACHE_HIT:
            context_str = build_context(similar)
            augmented = f"{context_str}\n\nNow answer this new request: {body.message}"
            history.append({"role": "user", "content": augmented})
        else:
            history.append({"role": "user", "content": body.message})

        raw_reply = chat_reply(history)
        cached = False

    # Parse materials and strip tags from display message
    reply, materials = _extract_materials(raw_reply)

    # Save assistant response (clean text) with embedding
    if chat_id:
        if cached:
            save_message(chat_id, "user", content=body.message)
        response_embedding = embed_text(reply)
        save_message(chat_id, "assistant", content=reply, embedding=response_embedding)

    return {"reply": reply, "chat_id": chat_id, "cached": cached, "materials": materials}


@router.get("/chats/{user_id}")
async def list_chats(user_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    authed_user = await verify_token(token)
    if not authed_user or authed_user != user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return get_chats(user_id)


@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return get_messages(chat_id)


@router.delete("/chats/{chat_id}")
async def remove_chat(chat_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    delete_chat(chat_id)
    return {"ok": True}
