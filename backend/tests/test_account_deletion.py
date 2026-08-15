import os

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
)

from fastapi import FastAPI
from fastapi.testclient import TestClient

import dependencies
import routes.account as account_routes
from services import supabase as storage_service

USER_ID = "00000000-0000-0000-0000-00000000000a"


def test_authenticated_user_can_delete_entire_account(monkeypatch):
    app = FastAPI()
    app.include_router(account_routes.router)
    called = []

    async def verify(token):
        return USER_ID if token == "valid" else None

    monkeypatch.setattr(dependencies, "verify_token", verify)
    monkeypatch.setattr(account_routes, "delete_account", called.append)

    with TestClient(app) as client:
        response = client.delete("/account", headers={"Authorization": "Bearer valid"})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert called == [USER_ID]


def test_account_deletion_requires_authentication(monkeypatch):
    app = FastAPI()
    app.include_router(account_routes.router)

    async def verify(_token):
        return None

    monkeypatch.setattr(dependencies, "verify_token", verify)
    with TestClient(app) as client:
        response = client.delete("/account", headers={"Authorization": "Bearer invalid"})

    assert response.status_code == 401


def test_account_deletion_removes_all_owner_storage_and_records(monkeypatch):
    deleted_tables = []
    removed_paths = []

    class Query:
        def __init__(self, table):
            self.table = table

        def delete(self):
            return self

        def eq(self, column, value):
            assert value == USER_ID
            return self

        def execute(self):
            deleted_tables.append(self.table)
            return type("Response", (), {"data": []})()

    class Bucket:
        def list(self, prefix):
            if prefix == USER_ID:
                return [{"name": "job-a", "id": None, "metadata": None}]
            if prefix == f"{USER_ID}/job-a":
                return [{"name": "photo.jpg", "id": "object-id", "metadata": {"size": 1}}]
            return []

        def remove(self, paths):
            removed_paths.extend(paths)

    class Storage:
        def from_(self, bucket):
            assert bucket == storage_service.BUCKET
            return Bucket()

    class Admin:
        def delete_user(self, user_id):
            assert user_id == USER_ID
            deleted_tables.append("auth.users")

    class Auth:
        admin = Admin()

    class Client:
        storage = Storage()
        auth = Auth()

        def table(self, name):
            return Query(name)

    monkeypatch.setattr(storage_service, "_client", Client())
    storage_service.delete_account(USER_ID)

    assert removed_paths == [f"{USER_ID}/job-a/photo.jpg"]
    assert deleted_tables == ["chats", "jobs", "profiles", "auth.users"]
