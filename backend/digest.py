import logging
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Iterable

from sqlalchemy.orm import Session, joinedload

from config import settings
from models import Job, ResumeScore, User

log = logging.getLogger(__name__)

DIGEST_TOP_N = 10
DIGEST_MIN_SCORE = 60
DIGEST_LOOKBACK_HOURS = 26


def is_email_enabled() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def _user_top_jobs(db: Session, user: User) -> list[tuple[Job, float]]:
    resume_ids = [r.id for r in user.resumes]
    if not resume_ids:
        return []

    cutoff = datetime.utcnow() - timedelta(hours=DIGEST_LOOKBACK_HOURS)

    rows = (
        db.query(ResumeScore, Job)
        .join(Job, ResumeScore.job_id == Job.id)
        .options(joinedload(ResumeScore.resume))
        .filter(
            ResumeScore.resume_id.in_(resume_ids),
            ResumeScore.score >= DIGEST_MIN_SCORE,
            Job.is_active.is_(True),
            Job.date_fetched >= cutoff,
        )
        .all()
    )

    best_per_job: dict[str, tuple[Job, float]] = {}
    for rs, job in rows:
        if job.id not in best_per_job or rs.score > best_per_job[job.id][1]:
            best_per_job[job.id] = (job, rs.score)

    ranked = sorted(best_per_job.values(), key=lambda x: x[1], reverse=True)
    return ranked[:DIGEST_TOP_N]


def _render_digest(user: User, items: list[tuple[Job, float]]) -> tuple[str, str]:
    lines_text: list[str] = [f"Hi {user.username},", ""]
    if not items:
        lines_text.append("No new strong matches in the past 24 hours.")
    else:
        lines_text.append(f"Top {len(items)} matches in the past 24 hours:")
        lines_text.append("")
        for job, score in items:
            lines_text.append(f"  [{score:>5.1f}]  {job.title} — {job.company}")
            lines_text.append(f"            {job.job_url}")

    rows_html = "".join(
        f'<tr><td style="padding:6px 12px 6px 0;font-family:monospace">{score:.1f}</td>'
        f'<td style="padding:6px 12px 6px 0">'
        f'<a href="{job.job_url}" style="color:#222;text-decoration:none">'
        f'<strong>{job.title}</strong></a><br>'
        f'<span style="color:#666;font-size:13px">{job.company}</span></td></tr>'
        for job, score in items
    )
    body_html = (
        f"<p>Hi {user.username},</p>"
        + (
            f"<p>Top {len(items)} matches in the past 24 hours:</p>"
            f'<table style="border-collapse:collapse">{rows_html}</table>'
            if items
            else "<p>No new strong matches in the past 24 hours.</p>"
        )
        + "<p style='color:#888;font-size:12px'>Reply STOP or toggle digests off in settings to unsubscribe.</p>"
    )
    return "\n".join(lines_text), body_html


def send_email(to: str, subject: str, text_body: str, html_body: str) -> None:
    if not is_email_enabled():
        log.info("email disabled (no SMTP_HOST); skipping send to %s", to)
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def send_digests_for_users(db: Session, users: Iterable[User]) -> int:
    if not is_email_enabled():
        log.info("digest run skipped — SMTP not configured")
        return 0
    sent = 0
    for user in users:
        if not user.email or not user.digest_enabled or user.is_demo:
            continue
        items = _user_top_jobs(db, user)
        text, html = _render_digest(user, items)
        try:
            send_email(user.email, "jobhunter daily digest", text, html)
            user.last_digest_at = datetime.utcnow()
            db.commit()
            sent += 1
        except Exception:
            log.exception("digest send failed for user %s", user.username)
    log.info("digest run complete: %d sent", sent)
    return sent


def run_daily_digest(db: Session) -> int:
    users = db.query(User).all()
    return send_digests_for_users(db, users)
