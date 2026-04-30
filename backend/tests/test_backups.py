import os
import time
from pathlib import Path

from backups import run_backup
from config import settings
from database import SessionLocal
from models import User


def test_backup_creates_snapshot_and_prunes_old(client):
    # Trigger creation of users table and write something so the db is non-empty
    db = SessionLocal()
    try:
        db.add(User(username="backup_owner"))
        db.commit()
    finally:
        db.close()

    backups_dir = Path(settings.backups_dir)
    backups_dir.mkdir(parents=True, exist_ok=True)
    for old in backups_dir.glob("*"):
        old.unlink()

    # Plant an old file beyond the retention window
    stale = backups_dir / "jobs_19990101_000000.db"
    stale.write_bytes(b"old")
    far_past = time.time() - (settings.backup_keep_days + 5) * 86400
    os.utime(stale, (far_past, far_past))
    assert stale.exists()

    out = run_backup()
    assert out is not None and out.exists()
    assert out.stat().st_size > 0
    assert not stale.exists(), "old backup should have been pruned"


def test_backup_returns_none_when_db_missing(monkeypatch, client, tmp_path):
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "nonexistent.db"))
    assert run_backup() is None
