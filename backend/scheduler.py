import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backups import run_backup
from config import settings
from database import SessionLocal
from digest import is_email_enabled, run_daily_digest
from fetcher import run_full_sync
from scorer import score_all_unscored

log = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _run_scheduled_sync():
    log.info("scheduled sync starting")
    db = SessionLocal()
    try:
        summary = run_full_sync(db)
        scored = score_all_unscored(db)
        summary["scored"] = scored
        log.info("scheduled sync complete: %s", summary)
    except Exception:
        log.exception("scheduled sync failed")
    finally:
        db.close()


def _run_scheduled_backup():
    try:
        run_backup()
    except Exception:
        log.exception("scheduled backup failed")


def _run_scheduled_digest():
    db = SessionLocal()
    try:
        run_daily_digest(db)
    except Exception:
        log.exception("scheduled digest failed")
    finally:
        db.close()


def start_scheduler(interval_hours: int) -> None:
    scheduler.add_job(
        _run_scheduled_sync,
        "interval",
        hours=interval_hours,
        id="full_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_scheduled_backup,
        CronTrigger(hour=3, minute=0),
        id="daily_backup",
        replace_existing=True,
    )
    if is_email_enabled():
        scheduler.add_job(
            _run_scheduled_digest,
            CronTrigger(hour=settings.digest_hour_utc, minute=0),
            id="daily_digest",
            replace_existing=True,
        )
        log.info("daily digest scheduled at %02d:00 UTC", settings.digest_hour_utc)
    else:
        log.info("daily digest disabled (no SMTP_HOST)")
    scheduler.start()
    log.info("scheduler started: sync interval=%dh, backup daily 03:00 UTC", interval_hours)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
