import os
import uuid

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
)

import pytest

from services import supabase as storage


USER_A = "00000000-0000-0000-0000-00000000000a"
USER_B = "00000000-0000-0000-0000-00000000000b"
JOB_A = "20000000-0000-0000-0000-00000000000a"
JOB_B = "20000000-0000-0000-0000-00000000000b"


def test_owner_path_is_unpredictable_and_scoped():
    first = storage.create_photo_path(USER_A, JOB_A, "repair.jpg", "image/jpeg")
    second = storage.create_photo_path(USER_A, JOB_A, "repair.jpg", "image/jpeg")
    assert first != second
    assert first.startswith(f"{USER_A}/{JOB_A}/")
    assert storage.validate_photo_path(first, USER_A, JOB_A) == first


@pytest.mark.parametrize(
    "path,user_id,job_id,error",
    [
        (f"{USER_A}/{JOB_A}/{'a' * 32}.jpg", USER_B, JOB_A, PermissionError),
        (f"{USER_A}/{JOB_A}/{'a' * 32}.jpg", USER_A, JOB_B, PermissionError),
        (f"{USER_A}/{JOB_A}/../secret.jpg", USER_A, JOB_A, ValueError),
        (f"{USER_A}/{JOB_A}/not-random.jpg", USER_A, JOB_A, ValueError),
    ],
)
def test_forged_cross_user_and_mismatched_paths_are_denied(path, user_id, job_id, error):
    with pytest.raises(error):
        storage.validate_photo_path(path, user_id, job_id)


def test_only_https_legacy_urls_are_accepted():
    assert storage.is_legacy_public_url("https://legacy.example/repair.jpg")
    assert not storage.is_legacy_public_url("http://legacy.example/repair.jpg")
    assert not storage.is_legacy_public_url("javascript:alert(1)")
    assert not storage.is_legacy_public_url(None)


def test_signed_url_has_short_expiry(monkeypatch):
    path = f"{USER_A}/{JOB_A}/{'a' * 32}.jpg"

    class Bucket:
        def create_signed_url(self, candidate, expires_in):
            assert candidate == path
            assert expires_in == 60
            return {"signedURL": "https://storage.example/signed?token=redacted"}

    class Storage:
        def from_(self, bucket):
            assert bucket == "repair-photos-private"
            return Bucket()

    class Client:
        storage = Storage()

    monkeypatch.setattr(storage, "_client", Client())
    result = storage.create_signed_photo_url(path, 60)
    assert result["image_url"].startswith("https://storage.example/signed")
    assert "image_url_expires_at" in result


def test_invalid_or_expired_signed_urls_are_never_accepted_as_object_identity():
    signed = "https://storage.example/object/sign/repair-photos-private/x?token=expired"
    with pytest.raises(ValueError):
        storage.validate_photo_path(signed, USER_A, JOB_A)


@pytest.mark.anyio
async def test_owner_upload_uses_private_bucket_and_returns_path(monkeypatch):
    uploaded = {}

    class Bucket:
        def upload(self, path, body, options):
            uploaded.update(path=path, body=body, options=options)

    class Storage:
        def from_(self, bucket):
            assert bucket == "repair-photos-private"
            return Bucket()

    class Client:
        storage = Storage()

    monkeypatch.setattr(storage, "_client", Client())
    monkeypatch.setattr(
        storage,
        "create_signed_photo_url",
        lambda path: {"image_url": "https://signed.example/photo", "image_url_expires_at": "soon"},
    )
    result = await storage.upload_private_image(
        USER_A, JOB_A, b"image", "repair.jpg", "image/jpeg"
    )
    assert result["photo_path"] == uploaded["path"]
    assert result["photo_path"].startswith(f"{USER_A}/{JOB_A}/")
    assert uploaded["options"] == {"content-type": "image/jpeg"}


def test_analyse_route_requires_authenticated_user_dependency():
    source = (storage.__file__.replace("services/supabase.py", "routes/analyse.py"))
    text = open(source, encoding="utf-8").read()
    assert "user_id: str = Depends(authenticated_user)" in text
