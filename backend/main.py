import hashlib
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from config import settings
from database import (
    SessionLocal,
    delete_resume,
    get_db,
    get_job_by_id,
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
    ApplicationRead,
    ApplicationUpdate,
    Job,
    JobRead,
    Resume,
    ResumeRead,
    ResumeScore,
    ResumeScoreRead,
    SearchTerm,
    SearchTermCreate,
    SearchTermRead,
    SearchTermUpdate,
)
from scheduler import start_scheduler, stop_scheduler
from scorer import load_resume_text, rescore_all_for_resume, score_all_unscored
from tailor import summarize_job, tailor_resume

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

ALLOWED_RESUME_EXTS = {".docx", ".pdf"}


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    start_scheduler(settings.sync_interval_hours)
    log.info("app started")
    yield
    stop_scheduler()


app = FastAPI(title="Job Hunter", version="0.2.0", lifespan=lifespan)


# Ordering note: Starlette's add_middleware uses insert(0), so middleware added
# later becomes the OUTER wrapper. For CORS headers to land on responses from
# unhandled-exception fallbacks, CORSMiddleware must be added AFTER the catch
# middleware so CORS is outermost and sees the fallback response on its way out.
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
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


last_sync: dict = {"status": "never", "started_at": None, "finished_at": None, "result": None, "error": None}


def _serialize_job(job: Job) -> dict:
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
    ]
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
            ApplicationRead.model_validate(job.application).model_dump()
            if job.application
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
        resume = get_resume(db, resume_id)
        if resume:
            count = rescore_all_for_resume(db, resume)
            log.info("rescored %d jobs for resume %s", count, resume.label)
    finally:
        db.close()


@app.get("/jobs")
def list_jobs(
    min_score: float | None = Query(None, ge=0, le=100),
    remote_only: bool = Query(False),
    search: str | None = Query(None),
    sort_by: str = Query("date", pattern="^(score|date|company)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Job)
        .options(
            joinedload(Job.resume_scores).joinedload(ResumeScore.resume),
            joinedload(Job.application),
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

    if min_score is not None:
        best_subq = (
            db.query(ResumeScore.job_id, func.max(ResumeScore.score).label("best"))
            .group_by(ResumeScore.job_id)
            .subquery()
        )
        query = query.join(best_subq, Job.id == best_subq.c.job_id).filter(
            best_subq.c.best >= min_score
        )

    if sort_by == "score":
        best_subq = (
            db.query(ResumeScore.job_id, func.max(ResumeScore.score).label("best"))
            .group_by(ResumeScore.job_id)
            .subquery()
        )
        query = query.outerjoin(best_subq, Job.id == best_subq.c.job_id).order_by(
            func.coalesce(best_subq.c.best, 0).desc()
        )
    elif sort_by == "company":
        query = query.order_by(Job.company.asc(), Job.date_fetched.desc())
    else:
        query = query.order_by(Job.date_fetched.desc())

    jobs = query.offset(skip).limit(limit).all()
    return [_serialize_job(j) for j in jobs]


@app.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = (
        db.query(Job)
        .options(
            joinedload(Job.resume_scores).joinedload(ResumeScore.resume),
            joinedload(Job.application),
        )
        .filter(Job.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "job not found")
    return _serialize_job(job)


@app.post("/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    if last_sync.get("status") == "running":
        raise HTTPException(409, "sync already in progress")
    background_tasks.add_task(_background_sync)
    return {"status": "sync started"}


@app.get("/sync/status")
def sync_status():
    return last_sync


@app.post("/jobs/{job_id}/tailor")
def tailor_job_resume(
    job_id: str,
    resume_id: str = Query(...),
    db: Session = Depends(get_db),
):
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

    resume = get_resume(db, resume_id)
    if not resume:
        raise HTTPException(404, "resume not found")

    try:
        file_path = tailor_resume(
            job_id=job.id,
            description=job.description,
            resume_id=resume_id,
            db=db,
        )
        summary = summarize_job(job.description)
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
):
    job = (
        db.query(Job)
        .options(joinedload(Job.application), joinedload(Job.resume_scores))
        .filter(Job.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "job not found")

    if job.application and job.application.resume_used:
        path = job.application.resume_used
        if os.path.isfile(path):
            return FileResponse(
                path,
                filename=os.path.basename(path),
            )

    if not resume_id and job.resume_scores:
        best = max(job.resume_scores, key=lambda rs: rs.score)
        resume_id = best.resume_id

    if not resume_id:
        raise HTTPException(404, "no resume selected and no scores available")

    resume = get_resume(db, resume_id)
    if not resume or not os.path.isfile(resume.file_path):
        raise HTTPException(404, "resume file not found")

    return FileResponse(
        resume.file_path,
        filename=resume.filename,
    )


@app.patch("/jobs/{job_id}/status", response_model=ApplicationRead)
def update_status(job_id: str, body: ApplicationUpdate, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
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
        status=body.status,
        notes=body.notes,
        applied_at=body.applied_at,
    )
    return application


@app.get("/resumes", response_model=list[ResumeRead])
def get_all_resumes(db: Session = Depends(get_db)):
    return list_resumes(db)


@app.post("/resumes", response_model=ResumeRead)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    label: str = Form(...),
    db: Session = Depends(get_db),
):
    filename = file.filename or "resume"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_RESUME_EXTS:
        raise HTTPException(400, f"unsupported file type: {ext} (allowed: .docx, .pdf)")

    content = await file.read()
    resume_id = hashlib.sha256(filename.encode() + content[:1024]).hexdigest()

    safe_name = f"{resume_id[:16]}{ext}"
    dest_path = os.path.join(settings.uploads_dir, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)

    extracted = load_resume_text(dest_path)

    existing = db.get(Resume, resume_id)
    if existing:
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
def remove_resume(resume_id: str, db: Session = Depends(get_db)):
    resume = get_resume(db, resume_id)
    if not resume:
        raise HTTPException(404, "resume not found")

    file_path = resume.file_path
    ok = delete_resume(db, resume_id)
    if not ok:
        raise HTTPException(404, "resume not found")

    if file_path and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError:
            log.warning("failed to remove resume file %s", file_path)

    return {"status": "deleted", "resume_id": resume_id}


@app.get("/search-terms", response_model=list[SearchTermRead])
def get_search_terms(db: Session = Depends(get_db)):
    return list_search_terms(db)


@app.post("/search-terms", response_model=SearchTermRead)
def create_search_term(body: SearchTermCreate, db: Session = Depends(get_db)):
    existing = db.query(SearchTerm).filter(SearchTerm.term == body.term).first()
    if existing:
        raise HTTPException(409, "search term already exists")

    term = SearchTerm(term=body.term, is_active=True)
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@app.patch("/search-terms/{term_id}", response_model=SearchTermRead)
def toggle_search_term(term_id: int, body: SearchTermUpdate, db: Session = Depends(get_db)):
    term = db.get(SearchTerm, term_id)
    if not term:
        raise HTTPException(404, "search term not found")
    term.is_active = body.is_active
    db.commit()
    db.refresh(term)
    return term


@app.delete("/search-terms/{term_id}")
def remove_search_term(term_id: int, db: Session = Depends(get_db)):
    term = db.get(SearchTerm, term_id)
    if not term:
        raise HTTPException(404, "search term not found")
    db.delete(term)
    db.commit()
    return {"status": "deleted", "id": term_id}
