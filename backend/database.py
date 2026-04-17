from datetime import datetime
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config import settings

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


def init_db() -> None:
    from models import (  # noqa: F401
        Application,
        Job,
        Resume,
        ResumeScore,
        SearchTerm,
    )

    Base.metadata.create_all(bind=engine)
    _seed_search_terms_if_empty()


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


def list_resumes(db: Session) -> list["Resume"]:
    from models import Resume

    return db.query(Resume).order_by(Resume.uploaded_at.desc()).all()


def get_resume(db: Session, resume_id: str) -> "Resume | None":
    from models import Resume

    return db.get(Resume, resume_id)


def delete_resume(db: Session, resume_id: str) -> bool:
    from models import Resume, ResumeScore

    resume = db.get(Resume, resume_id)
    if not resume:
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


def update_application_status(
    db: Session,
    job_id: str,
    *,
    status: str | None = None,
    resume_used: str | None = None,
    notes: str | None = None,
    applied_at: datetime | None = None,
) -> "Application":
    from models import APPLICATION_STATUSES, Application

    app = db.get(Application, job_id)
    if app is None:
        app = Application(
            job_id=job_id,
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
