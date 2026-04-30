import hashlib
import logging
import logging.handlers
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import auth as auth_mod
from auth import (
    USAGE_SUMMARIZE,
    USAGE_TAILOR,
    clear_session_cookie,
    current_user,
    enforce_quota,
    get_or_create_user,
    issue_session_cookie,
    record_usage,
    verify_app_password,
)
from config import settings
from database import (
    SessionLocal,
    delete_resume,
    get_application,
    get_db,
    get_resume,
    init_db,
    list_resumes,
    list_search_terms,
    update_application_status,
)
from fetcher import run_full_sync
from google.genai import errors as genai_errors
from models import (
    APPLICATION_STATUSES,
    Application,
    ApplicationRead,
    ApplicationUpdate,
    Job,
    JobRead,
    LoginRequest,
    LoginResponse,
    Resume,
    ResumeRead,
    ResumeScore,
    ResumeScoreRead,
    SearchTerm,
    SearchTermCreate,
    SearchTermRead,
    SearchTermUpdate,
    User,
    UserRead,
    UserUpdate,
)
from scheduler import start_scheduler, stop_scheduler
from scorer import load_resume_text, rescore_all_for_resume, score_all_unscored
from tailor import summarize_job, tailor_resume


def _configure_logging() -> None:
    root = logging.getLogger()
    if any(isinstance(h, logging.handlers.RotatingFileHandler) for h in root.handlers):
        return
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    root.setLevel(logging.INFO)
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        stream = logging.StreamHandler()
        stream.setFormatter(fmt)
        root.addHandler(stream)
    log_path = Path(settings.log_dir) / "app.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=5_000_000, backupCount=5
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)


_configure_logging()
log = logging.getLogger(__name__)

if settings.sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)
        log.info("sentry initialized")
    except ImportError:
        log.warning("SENTRY_DSN set but sentry_sdk not installed; skipping")

ALLOWED_RESUME_EXTS = {".docx", ".pdf"}


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    if settings.app_password == "changeme":
        log.warning(
            "APP_PASSWORD is the default 'changeme'. Set a real value before deploying."
        )
    if settings.session_secret == "dev-secret-change-me":
        log.warning(
            "SESSION_SECRET is the default. Set a real value before deploying."
        )
    if settings.demo_mode:
        db = SessionLocal()
        try:
            from auth import get_or_create_user as _gocu
            _gocu(db, "demo", is_demo=True)
        finally:
            db.close()
    start_scheduler(settings.sync_interval_hours)
    log.info("app started (cors_origins=%s, demo_mode=%s)", settings.cors_origin_list, settings.demo_mode)
    yield
    stop_scheduler()


app = FastAPI(title="Job Hunter", version="0.3.0", lifespan=lifespan)


@app.middleware("http")
async def catch_unhandled_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        log.exception("unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "internal server error", "type": exc.__class__.__name__},
        )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    log.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


last_sync: dict = {"status": "never", "started_at": None, "finished_at": None, "result": None, "error": None}


def _user_resume_ids(db: Session, user_id: str) -> set[str]:
    rows = db.query(Resume.id).filter(Resume.user_id == user_id).all()
    return {r[0] for r in rows}


def _serialize_job(job: Job, *, user_id: str, user_resume_ids: set[str]) -> dict:
    scores = [
        {
            "job_id": rs.job_id,
            "resume_id": rs.resume_id,
            "label": rs.resume.label if rs.resume else "",
            "score": rs.score,
            "matched_keywords": rs.matched_keywords or [],
            "missing_keywords": rs.missing_keywords or [],
            "date_scored": rs.date_scored,
        }
        for rs in (job.resume_scores or [])
        if rs.resume_id in user_resume_ids
    ]
    user_app = next(
        (a for a in (job.applications or []) if a.user_id == user_id),
        None,
    )
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "company_url": job.company_url,
        "job_url": job.job_url,
        "site": job.site,
        "description": job.description,
        "location": job.location,
        "city": job.city,
        "state": job.state,
        "is_remote": job.is_remote,
        "job_type": job.job_type,
        "min_salary": job.min_salary,
        "max_salary": job.max_salary,
        "date_posted": job.date_posted,
        "date_fetched": job.date_fetched,
        "is_active": job.is_active,
        "resume_scores": scores,
        "application": (
            ApplicationRead.model_validate(user_app).model_dump()
            if user_app
            else None
        ),
    }


def _background_sync():
    global last_sync
    last_sync = {
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
        "finished_at": None,
        "result": None,
        "error": None,
    }
    db = SessionLocal()
    try:
        summary = run_full_sync(db)
        scored = score_all_unscored(db)
        summary["scored"] = scored
        last_sync["status"] = "complete"
        last_sync["result"] = summary
    except Exception as exc:
        log.exception("background sync failed")
        last_sync["status"] = "error"
        last_sync["error"] = str(exc)
    finally:
        last_sync["finished_at"] = datetime.utcnow().isoformat()
        db.close()


def _background_rescore_for_resume(resume_id: str):
    db = SessionLocal()
    try:
        resume = db.get(Resume, resume_id)
        if resume:
            count = rescore_all_for_resume(db, resume)
            log.info("rescored %d jobs for resume %s", count, resume.label)
    finally:
        db.close()


@app.get("/health")
def healthcheck():
    return {"status": "ok", "version": app.version}


@app.get("/config")
def public_config():
    return {
        "demo_enabled": settings.demo_mode,
        "version": app.version,
    }


@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    if not verify_app_password(body.app_password):
        raise HTTPException(status_code=401, detail="invalid app password")
    user = get_or_create_user(db, body.username)
    issue_session_cookie(response, user.id)
    return LoginResponse(user=UserRead.model_validate(user))


@app.post("/auth/demo", response_model=LoginResponse)
def demo_login(response: Response, db: Session = Depends(get_db)):
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="demo mode not enabled")
    user = get_or_create_user(db, "demo", is_demo=True)
    issue_session_cookie(response, user.id)
    return LoginResponse(user=UserRead.model_validate(user))


@app.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"status": "ok"}


@app.patch("/auth/me", response_model=UserRead)
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot edit profile")
    if body.email is not None:
        email = body.email.strip()
        if email and "@" not in email:
            raise HTTPException(422, "invalid email")
        user.email = email or None
    if body.digest_enabled is not None:
        user.digest_enabled = body.digest_enabled
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@app.get("/auth/me", response_model=UserRead)
def whoami(user: User = Depends(current_user)):
    return UserRead.model_validate(user)


@app.get("/auth/quota")
def quota_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {
        "tailor": {
            "used": auth_mod.count_usage_today(db, user.id, USAGE_TAILOR),
            "limit": settings.daily_tailor_limit,
        },
        "summarize": {
            "used": auth_mod.count_usage_today(db, user.id, USAGE_SUMMARIZE),
            "limit": settings.daily_summarize_limit,
        },
    }


@app.get("/jobs")
def list_jobs(
    min_score: float | None = Query(None, ge=0, le=100),
    remote_only: bool = Query(False),
    search: str | None = Query(None),
    sort_by: str = Query("date", pattern="^(score|date|company)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    user_resume_ids = _user_resume_ids(db, user.id)

    query = (
        db.query(Job)
        .options(
            joinedload(Job.resume_scores).joinedload(ResumeScore.resume),
            joinedload(Job.applications),
        )
        .filter(Job.is_active.is_(True))
    )

    if remote_only:
        query = query.filter(Job.is_remote.is_(True))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Job.title.ilike(pattern)) | (Job.company.ilike(pattern))
        )

    def _scoped_best_subq():
        q = (
            db.query(ResumeScore.job_id, func.max(ResumeScore.score).label("best"))
            .filter(ResumeScore.resume_id.in_(user_resume_ids or [""]))
            .group_by(ResumeScore.job_id)
        )
        return q.subquery()

    if min_score is not None:
        if not user_resume_ids:
            return []
        best_subq = _scoped_best_subq()
        query = query.join(best_subq, Job.id == best_subq.c.job_id).filter(
            best_subq.c.best >= min_score
        )

    if sort_by == "score" and user_resume_ids:
        best_subq = _scoped_best_subq()
        query = query.outerjoin(best_subq, Job.id == best_subq.c.job_id).order_by(
            func.coalesce(best_subq.c.best, 0).desc()
        )
    elif sort_by == "company":
        query = query.order_by(Job.company.asc(), Job.date_fetched.desc())
    else:
        query = query.order_by(Job.date_fetched.desc())

    jobs = query.offset(skip).limit(limit).all()
    return [_serialize_job(j, user_id=user.id, user_resume_ids=user_resume_ids) for j in jobs]


@app.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = (
        db.query(Job)
        .options(
            joinedload(Job.resume_scores).joinedload(ResumeScore.resume),
            joinedload(Job.applications),
        )
        .filter(Job.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "job not found")
    return _serialize_job(
        job,
        user_id=user.id,
        user_resume_ids=_user_resume_ids(db, user.id),
    )


@app.post("/sync")
def trigger_sync(background_tasks: BackgroundTasks, user: User = Depends(current_user)):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot trigger sync")
    if last_sync.get("status") == "running":
        raise HTTPException(409, "sync already in progress")
    background_tasks.add_task(_background_sync)
    return {"status": "sync started"}


@app.get("/sync/status")
def sync_status(user: User = Depends(current_user)):
    return last_sync


@app.post("/jobs/{job_id}/tailor")
def tailor_job_resume(
    job_id: str,
    resume_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    enforce_quota(db, user, USAGE_TAILOR)

    job = (
        db.query(Job)
        .options(joinedload(Job.resume_scores))
        .filter(Job.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "job not found")
    if not job.description:
        raise HTTPException(400, "job has no description to tailor against")

    resume = get_resume(db, resume_id, user_id=user.id)
    if not resume:
        raise HTTPException(404, "resume not found")

    try:
        file_path = tailor_resume(
            job_id=job.id,
            description=job.description,
            resume_id=resume_id,
            user_id=user.id,
            db=db,
        )
        record_usage(db, user.id, USAGE_TAILOR)
        enforce_quota(db, user, USAGE_SUMMARIZE)
        summary = summarize_job(job.description)
        record_usage(db, user.id, USAGE_SUMMARIZE)
    except ValueError as exc:
        if "API key" in str(exc):
            raise HTTPException(503, "Gemini API key not configured; set GEMINI_API_KEY in backend/.env") from exc
        raise
    except genai_errors.ClientError as exc:
        if exc.code == 429:
            raise HTTPException(429, "Gemini API quota exceeded; check plan/billing at https://ai.dev/rate-limit") from exc
        raise HTTPException(502, f"Gemini API error ({exc.code}): {exc.message}") from exc
    except genai_errors.APIError as exc:
        raise HTTPException(502, f"Gemini API error: {exc.message}") from exc

    score_row = (
        db.query(ResumeScore)
        .filter(ResumeScore.job_id == job_id, ResumeScore.resume_id == resume_id)
        .first()
    )

    return {
        "file_path": file_path,
        "resume_id": resume_id,
        "label": resume.label,
        "missing_keywords": (score_row.missing_keywords if score_row else []) or [],
        "summary": summary,
    }


@app.get("/jobs/{job_id}/resume")
def download_resume(
    job_id: str,
    resume_id: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = (
        db.query(Job)
        .options(joinedload(Job.resume_scores))
        .filter(Job.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "job not found")

    user_app = get_application(db, job_id, user.id)
    if user_app and user_app.resume_used:
        path = user_app.resume_used
        if os.path.isfile(path):
            return FileResponse(path, filename=os.path.basename(path))

    user_resume_ids = _user_resume_ids(db, user.id)
    user_scores = [rs for rs in (job.resume_scores or []) if rs.resume_id in user_resume_ids]

    if not resume_id and user_scores:
        best = max(user_scores, key=lambda rs: rs.score)
        resume_id = best.resume_id

    if not resume_id:
        raise HTTPException(404, "no resume selected and no scores available")

    resume = get_resume(db, resume_id, user_id=user.id)
    if not resume or not os.path.isfile(resume.file_path):
        raise HTTPException(404, "resume file not found")

    return FileResponse(resume.file_path, filename=resume.filename)


@app.patch("/jobs/{job_id}/status", response_model=ApplicationRead)
def update_status(
    job_id: str,
    body: ApplicationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "job not found")

    if body.status and body.status not in APPLICATION_STATUSES:
        raise HTTPException(
            422,
            f"invalid status: {body.status!r}, must be one of {APPLICATION_STATUSES}",
        )

    application = update_application_status(
        db,
        job_id,
        user.id,
        status=body.status,
        notes=body.notes,
        applied_at=body.applied_at,
    )
    return application


@app.get("/resumes", response_model=list[ResumeRead])
def get_all_resumes(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list_resumes(db, user_id=user.id)


@app.post("/resumes", response_model=ResumeRead)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    label: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot upload")
    filename = file.filename or "resume"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_RESUME_EXTS:
        raise HTTPException(400, f"unsupported file type: {ext} (allowed: .docx, .pdf)")

    content = await file.read()
    resume_id = hashlib.sha256(user.id.encode() + filename.encode() + content[:1024]).hexdigest()

    safe_name = f"{resume_id[:16]}{ext}"
    dest_path = os.path.join(settings.uploads_dir, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)

    extracted = load_resume_text(dest_path)

    existing = db.get(Resume, resume_id)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(409, "resume id collision across users")
        existing.filename = filename
        existing.label = label
        existing.file_path = dest_path
        existing.extracted_text = extracted
        existing.uploaded_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        resume = existing
    else:
        resume = Resume(
            id=resume_id,
            user_id=user.id,
            filename=filename,
            label=label,
            file_path=dest_path,
            extracted_text=extracted,
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)

    background_tasks.add_task(_background_rescore_for_resume, resume_id)
    return resume


@app.delete("/resumes/{resume_id}")
def remove_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    resume = get_resume(db, resume_id, user_id=user.id)
    if not resume:
        raise HTTPException(404, "resume not found")

    file_path = resume.file_path
    ok = delete_resume(db, resume_id, user_id=user.id)
    if not ok:
        raise HTTPException(404, "resume not found")

    if file_path and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError:
            log.warning("failed to remove resume file %s", file_path)

    return {"status": "deleted", "resume_id": resume_id}


@app.get("/search-terms", response_model=list[SearchTermRead])
def get_search_terms(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list_search_terms(db)


@app.post("/search-terms", response_model=SearchTermRead)
def create_search_term(
    body: SearchTermCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot edit search terms")
    existing = db.query(SearchTerm).filter(SearchTerm.term == body.term).first()
    if existing:
        raise HTTPException(409, "search term already exists")

    term = SearchTerm(term=body.term, is_active=True)
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@app.patch("/search-terms/{term_id}", response_model=SearchTermRead)
def toggle_search_term(
    term_id: int,
    body: SearchTermUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot edit search terms")
    term = db.get(SearchTerm, term_id)
    if not term:
        raise HTTPException(404, "search term not found")
    term.is_active = body.is_active
    db.commit()
    db.refresh(term)
    return term


@app.delete("/search-terms/{term_id}")
def remove_search_term(
    term_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.is_demo:
        raise HTTPException(403, "demo accounts cannot edit search terms")
    term = db.get(SearchTerm, term_id)
    if not term:
        raise HTTPException(404, "search term not found")
    db.delete(term)
    db.commit()
    return {"status": "deleted", "id": term_id}
