import logging
from datetime import datetime
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config import settings

log = logging.getLogger(__name__)

Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False)

Base = declarative_base()

DEFAULT_SEARCH_TERMS = [
    "remote software engineer",
    "remote systems engineer",
    "remote help desk",
    "remote full stack developer",
]

BOOTSTRAP_USERNAME = "owner"


def init_db() -> None:
    from models import (  # noqa: F401
        Application,
        Job,
        LLMUsage,
        Resume,
        ResumeScore,
        SearchTerm,
        User,
    )

    Base.metadata.create_all(bind=engine)
    _migrate_existing_schema()
    _seed_search_terms_if_empty()


def _migrate_existing_schema() -> None:
    """Idempotent in-place migration: adds user_id to legacy resumes/applications.

    On first boot after upgrade, creates a bootstrap user and assigns any pre-existing
    resume / application rows to it. SQLite ALTER TABLE limitations mean Application's
    composite PK requires a table rebuild; only done if legacy single-PK shape remains.
    """
    from models import User

    inspector = inspect(engine)
    if "resumes" not in inspector.get_table_names():
        return

    resume_cols = {c["name"] for c in inspector.get_columns("resumes")}
    needs_resume_user = "user_id" not in resume_cols

    app_col_names: set[str] = set()
    if "applications" in inspector.get_table_names():
        app_col_names = {c["name"] for c in inspector.get_columns("applications")}
    needs_app_user = "applications" in inspector.get_table_names() and "user_id" not in app_col_names

    if not needs_resume_user and not needs_app_user:
        return

    db = SessionLocal()
    try:
        bootstrap = db.query(User).filter(User.username == BOOTSTRAP_USERNAME).first()
        if not bootstrap:
            bootstrap = User(username=BOOTSTRAP_USERNAME, is_demo=False)
            db.add(bootstrap)
            db.commit()
            db.refresh(bootstrap)
            log.info("created bootstrap user '%s' (id=%s) for legacy data", BOOTSTRAP_USERNAME, bootstrap.id)
        bootstrap_id = bootstrap.id
    finally:
        db.close()

    with engine.begin() as conn:
        if needs_resume_user:
            log.info("migrating: adding user_id to resumes")
            conn.execute(text("ALTER TABLE resumes ADD COLUMN user_id VARCHAR"))
            conn.execute(
                text("UPDATE resumes SET user_id = :uid WHERE user_id IS NULL"),
                {"uid": bootstrap_id},
            )

        if needs_app_user:
            log.info("migrating: rebuilding applications with composite (job_id, user_id) PK")
            conn.execute(text("ALTER TABLE applications RENAME TO applications_legacy"))
            conn.execute(
                text(
                    """
                    CREATE TABLE applications (
                        job_id VARCHAR NOT NULL,
                        user_id VARCHAR NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'saved',
                        resume_used VARCHAR,
                        notes TEXT,
                        applied_at DATETIME,
                        updated_at DATETIME,
                        PRIMARY KEY (job_id, user_id),
                        FOREIGN KEY (job_id) REFERENCES jobs(id),
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO applications (job_id, user_id, status, resume_used, notes, applied_at, updated_at)
                    SELECT job_id, :uid, status, resume_used, notes, applied_at, updated_at
                    FROM applications_legacy
                    """
                ),
                {"uid": bootstrap_id},
            )
            conn.execute(text("DROP TABLE applications_legacy"))


def _seed_search_terms_if_empty() -> None:
    from models import SearchTerm

    db = SessionLocal()
    try:
        if db.query(SearchTerm).count() == 0:
            for term in DEFAULT_SEARCH_TERMS:
                db.add(SearchTerm(term=term, is_active=True))
            db.commit()
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def upsert_job(db: Session, data: dict) -> "Job":
    from models import Job

    job_id = Job.make_id(data["title"], data["company"], data.get("location"))
    existing = db.get(Job, job_id)
    if existing:
        for key, value in data.items():
            if key != "id":
                setattr(existing, key, value)
        existing.date_fetched = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    job = Job(id=job_id, **data)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_jobs(
    db: Session,
    *,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> list["Job"]:
    from models import Job

    q = db.query(Job)
    if active_only:
        q = q.filter(Job.is_active.is_(True))
    return q.order_by(Job.date_fetched.desc()).offset(skip).limit(limit).all()


def get_job_by_id(db: Session, job_id: str) -> "Job | None":
    from models import Job

    return db.get(Job, job_id)


def upsert_resume_score(db: Session, data: dict) -> "ResumeScore":
    from models import ResumeScore

    existing = (
        db.query(ResumeScore)
        .filter(
            ResumeScore.job_id == data["job_id"],
            ResumeScore.resume_id == data["resume_id"],
        )
        .first()
    )
    if existing:
        for key, value in data.items():
            if key not in ("job_id", "resume_id"):
                setattr(existing, key, value)
        existing.date_scored = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    score = ResumeScore(**data)
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


def list_resumes(db: Session, *, user_id: str | None = None) -> list["Resume"]:
    from models import Resume

    q = db.query(Resume)
    if user_id is not None:
        q = q.filter(Resume.user_id == user_id)
    return q.order_by(Resume.uploaded_at.desc()).all()


def get_resume(db: Session, resume_id: str, *, user_id: str | None = None) -> "Resume | None":
    from models import Resume

    resume = db.get(Resume, resume_id)
    if resume is None:
        return None
    if user_id is not None and resume.user_id != user_id:
        return None
    return resume


def delete_resume(db: Session, resume_id: str, *, user_id: str | None = None) -> bool:
    from models import Resume, ResumeScore

    resume = db.get(Resume, resume_id)
    if not resume:
        return False
    if user_id is not None and resume.user_id != user_id:
        return False
    db.query(ResumeScore).filter(ResumeScore.resume_id == resume_id).delete()
    db.delete(resume)
    db.commit()
    return True


def list_search_terms(db: Session, *, active_only: bool = False) -> list["SearchTerm"]:
    from models import SearchTerm

    q = db.query(SearchTerm)
    if active_only:
        q = q.filter(SearchTerm.is_active.is_(True))
    return q.order_by(SearchTerm.created_at.asc()).all()


def get_application(db: Session, job_id: str, user_id: str) -> "Application | None":
    from models import Application

    return (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.user_id == user_id)
        .first()
    )


def update_application_status(
    db: Session,
    job_id: str,
    user_id: str,
    *,
    status: str | None = None,
    resume_used: str | None = None,
    notes: str | None = None,
    applied_at: datetime | None = None,
) -> "Application":
    from models import APPLICATION_STATUSES, Application

    app = (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.user_id == user_id)
        .first()
    )
    if app is None:
        app = Application(
            job_id=job_id,
            user_id=user_id,
            status=status or "saved",
            resume_used=resume_used,
            notes=notes,
            applied_at=applied_at,
        )
        db.add(app)
    else:
        if status is not None:
            if status not in APPLICATION_STATUSES:
                raise ValueError(f"Invalid status: {status!r}. Must be one of {APPLICATION_STATUSES}")
            app.status = status
        if resume_used is not None:
            app.resume_used = resume_used
        if notes is not None:
            app.notes = notes
        if applied_at is not None:
            app.applied_at = applied_at

    app.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(app)
    return app
