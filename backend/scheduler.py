import logging

from apscheduler.schedulers.background import BackgroundScheduler

from database import SessionLocal
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


def start_scheduler(interval_hours: int) -> None:
    scheduler.add_job(
        _run_scheduled_sync,
        "interval",
        hours=interval_hours,
        id="full_sync",
        replace_existing=True,
    )
    scheduler.start()
    log.info("scheduler started, interval=%dh", interval_hours)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
