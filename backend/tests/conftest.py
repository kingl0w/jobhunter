import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Set env vars BEFORE config.py is imported anywhere so settings = Settings() picks them up.
_TMP = tempfile.mkdtemp(prefix="jobhunter-test-")
os.environ["APP_PASSWORD"] = "testpass"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DB_PATH"] = os.path.join(_TMP, "jobs.db")
os.environ["LOG_DIR"] = os.path.join(_TMP, "logs")
os.environ["BACKUPS_DIR"] = os.path.join(_TMP, "backups")
os.environ["RESUMES_DIR"] = os.path.join(_TMP, "resumes")
os.environ["UPLOADS_DIR"] = os.path.join(_TMP, "resumes", "uploads")
os.environ["TAILORED_RESUMES_DIR"] = os.path.join(_TMP, "resumes", "tailored")
os.environ["DAILY_TAILOR_LIMIT"] = "3"
os.environ["DAILY_SUMMARIZE_LIMIT"] = "5"

import pytest  # noqa: E402


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from database import Base, engine, init_db
    import main

    Base.metadata.drop_all(bind=engine)
    init_db()
    return TestClient(main.app)


@pytest.fixture()
def authed_client(client):
    r = client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    assert r.status_code == 200, r.text
    return client
