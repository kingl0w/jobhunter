import logging
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path

from config import settings

log = logging.getLogger(__name__)


def _db_file() -> Path:
    return Path(settings.db_path)


def run_backup() -> Path | None:
    """Make a consistent SQLite snapshot using the online backup API.

    Safer than `cp` because it locks rows during pages copy and works while the
    main process holds an open connection (WAL mode).
    """
    src = _db_file()
    if not src.exists():
        log.info("backup skipped — db file does not exist yet")
        return None

    backups_dir = Path(settings.backups_dir)
    backups_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = backups_dir / f"jobs_{timestamp}.db"

    src_conn = sqlite3.connect(str(src))
    try:
        dst_conn = sqlite3.connect(str(dest))
        try:
            with dst_conn:
                src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
    finally:
        src_conn.close()

    log.info("backup created: %s (%d bytes)", dest, dest.stat().st_size)
    _prune_old(backups_dir)
    return dest


def _prune_old(backups_dir: Path) -> None:
    keep_days = max(int(settings.backup_keep_days), 1)
    cutoff = time.time() - keep_days * 86400
    removed = 0
    for path in backups_dir.glob("jobs_*.db"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError as exc:
            log.warning("failed to prune %s: %s", path, exc)
    if removed:
        log.info("pruned %d old backups (older than %d days)", removed, keep_days)


def next_backup_run_at() -> datetime:
    """Compute the next 03:00 UTC slot, used as the backup trigger time."""
    now = datetime.utcnow()
    target = now.replace(hour=3, minute=0, second=0, microsecond=0)
    if target <= now:
        target = target + timedelta(days=1)
    return target
