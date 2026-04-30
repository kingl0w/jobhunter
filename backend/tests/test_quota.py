from auth import USAGE_TAILOR, count_usage_today, enforce_quota, record_usage
from database import SessionLocal
from fastapi import HTTPException
from models import User


def _make_user(db, username: str, *, is_demo: bool = False) -> User:
    user = User(username=username, is_demo=is_demo)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_quota_counts_per_user_per_kind(client):
    db = SessionLocal()
    try:
        a = _make_user(db, "alpha")
        b = _make_user(db, "bravo")
        for _ in range(2):
            record_usage(db, a.id, USAGE_TAILOR)
        record_usage(db, b.id, USAGE_TAILOR)
        assert count_usage_today(db, a.id, USAGE_TAILOR) == 2
        assert count_usage_today(db, b.id, USAGE_TAILOR) == 1
    finally:
        db.close()


def test_enforce_quota_blocks_at_limit(client):
    db = SessionLocal()
    try:
        u = _make_user(db, "limited")
        for _ in range(3):
            record_usage(db, u.id, USAGE_TAILOR)
        try:
            enforce_quota(db, u, USAGE_TAILOR)
        except HTTPException as exc:
            assert exc.status_code == 429
        else:
            raise AssertionError("expected 429")
    finally:
        db.close()


def test_quota_endpoint_reports_usage(client):
    client.post("/auth/login", json={"app_password": "testpass", "username": "qq"})
    body = client.get("/auth/quota").json()
    assert body["tailor"]["limit"] == 3
    assert body["summarize"]["limit"] == 5
    assert body["tailor"]["used"] == 0
