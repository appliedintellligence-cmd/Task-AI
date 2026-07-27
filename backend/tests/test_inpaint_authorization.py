import os

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
)

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

import dependencies
import routes.inpaint as inpaint_routes


USER_A = "00000000-0000-0000-0000-00000000000a"
USER_B = "00000000-0000-0000-0000-00000000000b"
JOB_A = "20000000-0000-0000-0000-00000000000a"
JOB_B = "20000000-0000-0000-0000-00000000000b"
PHOTO_A = f"{USER_A}/{JOB_A}/{'a' * 32}.jpg"
PHOTO_B = f"{USER_B}/{JOB_B}/{'b' * 32}.jpg"


@pytest.fixture
def client(monkeypatch):
    tokens = {"token-a": USER_A, "token-b": USER_B}
    jobs = {
        (USER_A, JOB_A): {"id": JOB_A, "user_id": USER_A, "photo_path": PHOTO_A},
        (USER_B, JOB_B): {"id": JOB_B, "user_id": USER_B, "photo_path": PHOTO_B},
    }
    replicate_calls = []

    async def verify(token):
        return tokens.get(token)

    async def generate(*args, **kwargs):
        replicate_calls.append((args, kwargs))
        return ["https://replicate.example/preview.webp"]

    monkeypatch.setattr(dependencies, "verify_token", verify)
    monkeypatch.setattr(inpaint_routes, "get_job", lambda user_id, job_id: jobs.get((user_id, job_id)))
    monkeypatch.setattr(inpaint_routes.replicate, "async_run", generate)

    app = FastAPI()
    app.include_router(inpaint_routes.router)
    with TestClient(app) as test_client:
        test_client.app.state.replicate_calls = replicate_calls
        yield test_client


def auth(token="token-a"):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("headers", [{}, auth("invalid"), auth("expired")])
def test_inpaint_rejects_missing_invalid_and_expired_authentication(client, headers):
    response = client.post("/inpaint", headers=headers, json={"inpaint_prompt": "repair wall"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    assert client.app.state.replicate_calls == []


def test_authenticated_inpaint_without_private_reference_works(client):
    response = client.post("/inpaint", headers=auth(), json={"inpaint_prompt": "repair wall"})
    assert response.status_code == 200
    assert response.json() == {"repaired_image_url": "https://replicate.example/preview.webp"}
    assert len(client.app.state.replicate_calls) == 1


def test_owner_can_process_saved_or_fresh_private_repair_photo(client):
    saved = client.post(
        "/inpaint",
        headers=auth(),
        json={"inpaint_prompt": "repair wall", "job_id": JOB_A, "photo_path": PHOTO_A},
    )
    fresh_job = "30000000-0000-0000-0000-00000000000a"
    fresh_path = f"{USER_A}/{fresh_job}/{'c' * 32}.jpg"
    fresh = client.post(
        "/inpaint",
        headers=auth(),
        json={"inpaint_prompt": "repair wall", "job_id": fresh_job, "photo_path": fresh_path},
    )
    assert saved.status_code == 200
    assert fresh.status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {"inpaint_prompt": "repair wall", "job_id": JOB_B},
        {"inpaint_prompt": "repair wall", "job_id": JOB_B, "photo_path": PHOTO_B},
        {"inpaint_prompt": "repair wall", "job_id": JOB_A, "photo_path": PHOTO_B},
    ],
)
def test_user_cannot_process_another_users_job_or_private_photo(client, payload):
    response = client.post("/inpaint", headers=auth(), json=payload)
    assert response.status_code == 404
    assert response.json() == {"detail": "Repair resource not found"}
    assert client.app.state.replicate_calls == []
