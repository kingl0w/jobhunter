from datetime import datetime, timedelta
from unittest.mock import patch

from database import SessionLocal
from digest import _user_top_jobs, run_daily_digest
from models import Job, Resume, ResumeScore, User


def _seed(db, *, score: float, fresh: bool = True) -> tuple[User, Job, Resume]:
    user = User(username="dg-user", email="dg@example.com", digest_enabled=True)
    db.add(user)
    db.flush()
    resume = Resume(
        id="r1",
        user_id=user.id,
        filename="cv.docx",
        label="cv",
        file_path="/tmp/x",
        extracted_text="python",
    )
    job = Job(
        id=Job.make_id("Engineer", "Acme", "Remote"),
        title="Engineer",
        company="Acme",
        job_url="https://example.com/job",
        site="indeed",
        description="python and postgres",
        is_remote=True,
        date_fetched=datetime.utcnow() if fresh else datetime.utcnow() - timedelta(days=3),
    )
    db.add_all([resume, job])
    db.flush()
    db.add(ResumeScore(job_id=job.id, resume_id=resume.id, score=score))
    db.commit()
    return user, job, resume


def test_top_jobs_returns_high_scoring_recent_only(client):
    db = SessionLocal()
    try:
        user, job, _ = _seed(db, score=85)
        items = _user_top_jobs(db, user)
        assert len(items) == 1
        assert items[0][0].id == job.id
        assert items[0][1] == 85
    finally:
        db.close()


def test_top_jobs_excludes_low_score(client):
    db = SessionLocal()
    try:
        user, _, _ = _seed(db, score=40)
        assert _user_top_jobs(db, user) == []
    finally:
        db.close()


def test_top_jobs_excludes_stale(client):
    db = SessionLocal()
    try:
        user, _, _ = _seed(db, score=85, fresh=False)
        assert _user_top_jobs(db, user) == []
    finally:
        db.close()


def test_run_daily_digest_skips_when_no_smtp(client):
    db = SessionLocal()
    try:
        _seed(db, score=85)
        # No SMTP_HOST configured in tests → should no-op.
        assert run_daily_digest(db) == 0
    finally:
        db.close()


def test_run_daily_digest_calls_send_when_smtp_configured(client, monkeypatch):
    db = SessionLocal()
    try:
        _seed(db, score=85)
        from config import settings as live_settings

        monkeypatch.setattr(live_settings, "smtp_host", "smtp.example.com")
        monkeypatch.setattr(live_settings, "smtp_from", "noreply@example.com")

        with patch("digest.send_email") as send:
            sent = run_daily_digest(db)
        assert sent == 1
        send.assert_called_once()
        args, _ = send.call_args
        assert args[0] == "dg@example.com"
    finally:
        db.close()
