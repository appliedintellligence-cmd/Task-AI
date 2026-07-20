import os

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import dependencies
import routes.chat as chat_routes
import routes.jobs as job_routes

app = FastAPI()
app.include_router(chat_routes.router)
app.include_router(job_routes.router)


USER_A = "00000000-0000-0000-0000-00000000000a"
USER_B = "00000000-0000-0000-0000-00000000000b"
CHAT_A = "10000000-0000-0000-0000-00000000000a"
CHAT_B = "10000000-0000-0000-0000-00000000000b"
JOB_A = "20000000-0000-0000-0000-00000000000a"
JOB_B = "20000000-0000-0000-0000-00000000000b"


@pytest.fixture
def client(monkeypatch):
    tokens = {"token-a": USER_A, "token-b": USER_B}

    async def verify(token):
        return tokens.get(token)

    chats = {
        CHAT_A: {"id": CHAT_A, "user_id": USER_A, "title": "A chat"},
        CHAT_B: {"id": CHAT_B, "user_id": USER_B, "title": "B chat"},
    }
    messages = {
        CHAT_A: [{"id": "message-a", "chat_id": CHAT_A, "role": "assistant", "content": "A private answer"}],
        CHAT_B: [{"id": "message-b", "chat_id": CHAT_B, "role": "assistant", "content": "B private answer"}],
    }
    jobs = {
        USER_A: [{
            "id": JOB_A,
            "user_id": USER_A,
            "image_url": "https://images.example/a.jpg",
            "result_json": {"problem": "A diagnosis", "diy_assessment": {"safety_level": 1}},
        }],
        USER_B: [{
            "id": JOB_B,
            "user_id": USER_B,
            "image_url": "https://images.example/b.jpg",
            "result_json": {"problem": "B diagnosis", "diy_assessment": {"safety_level": 4}},
        }],
    }
    saved_messages = []

    monkeypatch.setattr(dependencies, "verify_token", verify)
    monkeypatch.setattr(chat_routes, "owns_chat", lambda user_id, chat_id: chats.get(chat_id, {}).get("user_id") == user_id)
    monkeypatch.setattr(chat_routes, "get_chats", lambda user_id: [c for c in chats.values() if c["user_id"] == user_id])
    monkeypatch.setattr(chat_routes, "get_messages", lambda user_id, chat_id: messages[chat_id] if chats.get(chat_id, {}).get("user_id") == user_id else [])

    def delete_chat(user_id, chat_id):
        if chats.get(chat_id, {}).get("user_id") != user_id:
            return False
        del chats[chat_id]
        return True

    def save_message(user_id, chat_id, role, **kwargs):
        if chats.get(chat_id, {}).get("user_id") != user_id:
            raise LookupError("Chat not found")
        saved_messages.append((user_id, chat_id, role, kwargs))
        return "new-message"

    monkeypatch.setattr(chat_routes, "delete_chat", delete_chat)
    monkeypatch.setattr(chat_routes, "save_message", save_message)
    monkeypatch.setattr(chat_routes, "embed_text", lambda _text: None)
    monkeypatch.setattr(chat_routes, "chat_reply", lambda _history: "Safe reply")
    monkeypatch.setattr(
        chat_routes,
        "guard_chat_advice",
        lambda **_kwargs: (
            "Safe reply",
            type("Assessment", (), {"model_dump": lambda self, **kwargs: {"assessment_status": "complete"}})(),
            False,
        ),
    )

    async def get_jobs(user_id):
        return jobs[user_id]

    def get_job(user_id, job_id):
        return next((job for job in jobs[user_id] if job["id"] == job_id), None)

    async def get_similar_jobs(user_id, job_id):
        assert get_job(user_id, job_id)
        return jobs[user_id]

    monkeypatch.setattr(job_routes, "get_jobs", get_jobs)
    monkeypatch.setattr(job_routes, "get_job", get_job)
    monkeypatch.setattr(job_routes, "get_similar_jobs", get_similar_jobs)

    captured_jobs = []

    async def save_job(**kwargs):
        captured_jobs.append(kwargs)
        return "new-job"

    monkeypatch.setattr(job_routes, "save_job", save_job)
    monkeypatch.setattr(job_routes, "validate_result_for_save", lambda result: result)

    with TestClient(app) as test_client:
        app.state.saved_messages = saved_messages
        app.state.captured_jobs = captured_jobs
        yield test_client


def auth(token="token-a"):
    return {"Authorization": f"Bearer {token}"}


def test_user_can_list_and_read_own_chat(client):
    listed = client.get("/chats", headers=auth())
    loaded = client.get(f"/chats/{CHAT_A}/messages", headers=auth())
    assert listed.status_code == 200
    assert listed.json() == [{"id": CHAT_A, "user_id": USER_A, "title": "A chat"}]
    assert loaded.status_code == 200
    assert loaded.json()[0]["content"] == "A private answer"


def test_user_cannot_read_or_list_another_users_chat_messages(client):
    response = client.get(f"/chats/{CHAT_B}/messages", headers=auth())
    assert response.status_code == 404
    assert response.json() == {"detail": "Chat not found"}
    assert "B private answer" not in response.text


def test_user_cannot_update_another_users_chat(client):
    response = client.post(
        "/chat",
        headers={**auth(), "Content-Type": "application/json"},
        json={"chat_id": CHAT_B, "message": "append to B"},
    )
    assert response.status_code == 404
    assert client.app.state.saved_messages == []


def test_user_cannot_delete_another_users_chat(client):
    response = client.delete(f"/chats/{CHAT_B}", headers=auth())
    assert response.status_code == 404
    assert client.get(f"/chats/{CHAT_B}/messages", headers=auth("token-b")).status_code == 200


def test_authorized_chat_write_workflow_still_passes(client):
    response = client.post(
        "/chat",
        headers={**auth(), "Content-Type": "application/json"},
        json={"chat_id": CHAT_A, "message": "my repair"},
    )
    assert response.status_code == 200
    assert response.json()["chat_id"] == CHAT_A
    assert {entry[2] for entry in client.app.state.saved_messages} == {"user", "assistant"}


def test_claimed_user_id_never_overrides_jwt_for_lists_or_writes(client):
    listed = client.get(f"/jobs/{USER_B}", headers=auth())
    assert listed.status_code == 200
    assert [job["id"] for job in listed.json()] == [JOB_A]
    assert "b.jpg" not in listed.text
    assert "B diagnosis" not in listed.text
    assert '"safety_level":4' not in listed.text

    created = client.post(
        "/jobs",
        headers={**auth(), "Content-Type": "application/json"},
        json={"user_id": USER_B, "image_url": "https://images.example/a.jpg", "result": {}},
    )
    assert created.status_code == 200
    assert client.app.state.captured_jobs[0]["user_id"] == USER_A


def test_user_cannot_access_another_users_job_or_similar_records(client):
    response = client.get(f"/similar/{JOB_B}", headers=auth())
    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}
    assert "b.jpg" not in response.text
    assert "B diagnosis" not in response.text
    assert "safety_level" not in response.text

    own = client.get(f"/similar/{JOB_A}", headers=auth())
    assert own.status_code == 200
    assert [job["id"] for job in own.json()] == [JOB_A]
    assert USER_B not in own.text


@pytest.mark.parametrize("headers", [{}, auth("invalid"), auth("expired")])
def test_missing_invalid_and_expired_tokens_are_rejected(client, headers):
    response = client.get("/chats", headers=headers)
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_guided_assessment_verification_requires_authentication(client):
    assert client.post("/assessments/verify", json={"result": {}}).status_code == 401
