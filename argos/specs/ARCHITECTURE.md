# jobhunter — Architecture

**Created:** 2026-04-24
**Last material change:** 2026-04-24

This document describes the structure of jobhunter: the shape of its parts, the contracts between them, and the invariants that hold across all tickets. It is canonical. If the code contradicts this document, the code is drifting — file an ADR and update this file.

## System shape

Two processes. A FastAPI backend (`backend/main.py`, port 8000) owns the SQLite DB, the resume filesystem, an in-process APScheduler, and all external calls (python-jobspy scraping, Gemini API). A Next.js 14 frontend (`frontend/`, port 3000) is a thin client that fetches JSON from the backend. The scheduler triggers `run_full_sync` → `score_all_unscored` every `SYNC_INTERVAL_HOURS` (default 6); the user can trigger the same pipeline manually via `POST /sync`. No worker process, no message bus.

```
browser (Next.js :3000, client components)
   │
   ├── HTTP fetch ──▶ FastAPI (:8000)
                        ├── SQLite (data/jobs.db, WAL, foreign_keys=ON)
                        ├── APScheduler BackgroundScheduler (in-process)
                        ├── python-jobspy ──▶ Indeed, LinkedIn
                        └── google-genai ──▶ gemini-2.5-flash
                        │
                        └── FS: resumes/{uploads,tailored}
```

## Components

### `backend/main.py` — API layer
FastAPI app. Lifespan boots `init_db()` and `start_scheduler(SYNC_INTERVAL_HOURS)`. Owns every HTTP route; business logic lives in sibling modules. Two middlewares: unhandled-exception catch (returns 500 with exception class name) and request log. Owns CORS (single allowed origin `http://localhost:3000`).

### `backend/fetcher.py` — Scraper
Wraps `python-jobspy`. `FULL_SITES = ["indeed", "linkedin"]` are scraped in production; `ALL_SITES` also includes `zip_recruiter` and `google` but they're excluded via `FLAKY_SITES` guard. Concurrent scrapes (`ThreadPoolExecutor`) per (site, term) pair. Every active `SearchTerm` is queried. Upserts via `upsert_job()` → deterministic `Job.make_id`. Jobs not re-seen for `STALE_DAYS=14` are marked `is_active=False`.

### `backend/scorer.py` — Keyword scorer
Non-LLM. Regex + `SYNONYM_MAP` extraction of required / preferred fragments from job description; matches against resume text extracted from `.docx` or `.pdf`. Writes `(job_id, resume_id, score, matched_keywords, missing_keywords)` rows into `resume_scores`. Entry points: `score_all_unscored`, `rescore_all_for_resume`, `load_resume_text`.

### `backend/tailor.py` — Gemini tailoring
Only LLM-using module. Two entry points: `summarize_job` (3-sentence ≤80-word summary) and `tailor_resume` (rewrites base `.docx` against the JD). `ground_check_keywords` restricts output keywords to those already present in the base resume to prevent fabrication. Outputs written to `resumes/tailored/`. Client is a module-global lazy `genai.Client`.

### `backend/scheduler.py` — APScheduler wrapper
Single `BackgroundScheduler` job (`id=full_sync`, interval in hours from settings). Thin: just bridges the scheduler callback to `run_full_sync` + `score_all_unscored`.

### `backend/models.py` — ORM + Pydantic
SQLAlchemy tables: `jobs`, `resumes`, `resume_scores` (composite PK `job_id`+`resume_id`), `search_terms`, `applications` (1:1 with jobs). Pydantic `*Read` / `*Create` / `*Update` schemas live in the same file.

### `backend/database.py` — DB access
Engine, `SessionLocal`, `get_db` FastAPI dependency. `init_db` calls `Base.metadata.create_all` and seeds `DEFAULT_SEARCH_TERMS` if the table is empty. Applies SQLite pragmas `journal_mode=WAL` and `foreign_keys=ON` on every connection. Houses upsert / list / delete helpers reused by API and scorer.

### `backend/config.py` — Settings
`pydantic-settings` reads `.env`. Fields: `gemini_api_key`, `db_path` (default `data/jobs.db`), `resumes_dir`, `uploads_dir`, `tailored_resumes_dir`, `sync_interval_hours` (6), `max_results_per_source` (25), `hours_old` (72). Relative paths are resolved against the project root.

### `backend/migrate.py` — one-off migration
Historical script for the "old IT/Dev schema → generic multi-resume" cutover. Backs up `data/jobs.db` to `.bak` before touching it. Not part of the runtime path.

### `frontend/app/` — Next.js 14 app router, client-side
Routes: `/` (`page.tsx`, declared `"use client"`; job list with filters — search, min_score, remote_only, sort_by, source, resume, date_posted, hasSalary), `/jobs/[id]` (detail), `/settings` (resumes + search terms CRUD). Shared fetchers in `app/api.ts`, types in `app/types.ts`, row UI in `app/components/job-card.tsx`. No server-component data fetching — everything goes to `http://localhost:8000` from the browser.

## Contracts

### HTTP — frontend → backend
- `GET /jobs?min_score&remote_only&search&sort_by={score|date|company}&skip&limit` → list of job objects with nested `resume_scores` and `application`.
- `GET /jobs/{id}` → single job.
- `POST /sync` → kicks `_background_sync`, returns `{status: "sync started"}`. 409 if already running.
- `GET /sync/status` → last_sync dict (status, started_at, finished_at, result, error).
- `POST /jobs/{id}/tailor?resume_id=…` → `{file_path, resume_id, label, missing_keywords, summary}`. 503 if `GEMINI_API_KEY` unset, 429 on Gemini quota, 502 on other Gemini errors.
- `GET /jobs/{id}/resume?resume_id=…` → streams the `.docx` (prefers already-tailored, falls back to best-scoring uploaded resume).
- `PATCH /jobs/{id}/status` → body: `ApplicationUpdate` (status, notes, applied_at, resume_used). Validates status against `APPLICATION_STATUSES`.
- `GET|POST|DELETE /resumes`, `PATCH /search-terms/{id}`, etc. — see `backend/main.py`.

### DB schema (high-level)
- `jobs(id PK, title, company, company_url, job_url, site, description, location, city, state, is_remote, job_type, min_salary, max_salary, date_posted, date_fetched, is_active)`.
- `resumes(id PK, filename, label, file_path, extracted_text, uploaded_at)`.
- `resume_scores(job_id FK, resume_id FK, score, matched_keywords JSON, missing_keywords JSON, date_scored)` — composite PK.
- `search_terms(id PK, term UNIQUE, is_active, created_at)`.
- `applications(job_id PK/FK, status, resume_used, notes, applied_at, updated_at)`.

### External
- python-jobspy: called with `site_name, search_term, is_remote, results_wanted, hours_old, description_format="markdown"`. Per-site kwargs in `_site_kwargs`.
- Gemini: `generate_content(model="gemini-2.5-flash", config=GenerateContentConfig(max_output_tokens, thinking_config=ThinkingConfig(thinking_budget=0)))`.

## Invariants

Violating any of these requires an ADR.

- **Deterministic job identity.** `Job.id = SHA256(title|company|location)`, lowercased and whitespace-trimmed. No auto-increment IDs for jobs. Cross-source dedup depends on this.
- **SQLite pragmas always on.** Every connection sets `journal_mode=WAL` and `foreign_keys=ON` (see `@event.listens_for(engine, "connect")` in `backend/database.py`).
- **Tailored resumes never fabricate skills.** `tailor_resume` must run `ground_check_keywords` and drop any missing_keyword that doesn't appear (case-insensitive, word-boundary) in the base resume text.
- **Single CORS origin.** Exactly `http://localhost:3000`. The app is not designed to be reachable from elsewhere.
- **Resume formats.** Only `.docx` and `.pdf` may be uploaded (`ALLOWED_RESUME_EXTS` in `backend/main.py`). Extraction for scoring assumes these two.
- **Application status state machine.** Status must be one of `APPLICATION_STATUSES = ("saved","applied","phone_screen","interview","offer","rejected")`. Validated in both `update_application_status` and the `PATCH` route.
- **Scheduler is in-process, single instance.** There is no external worker. Any "background job" is an APScheduler `BackgroundScheduler` job or a FastAPI `BackgroundTask`.
- **Only `backend/tailor.py` calls the LLM.** Scoring (`scorer.py`) is keyword-based. Adding LLM calls elsewhere is an architectural change, not a drive-by.

## Technology choices

- **Languages:** Python 3.12 (backend), TypeScript 5 (frontend).
- **Frameworks:** FastAPI, SQLAlchemy (declarative_base), APScheduler, Pydantic v2 + pydantic-settings (backend). Next.js 14.2 app router, React 18, Tailwind 3.4 (frontend).
- **Database:** SQLite (WAL), one file at `data/jobs.db`. `init_db` uses `create_all`; no Alembic.
- **LLM:** Gemini `gemini-2.5-flash` via `google-genai`. `thinking_budget=0` (no reasoning tokens).
- **Scraping:** python-jobspy. Indeed + LinkedIn in production.
- **Deploy:** `docker-compose.yml` builds backend only (base image `python:3.12-slim`), exposes `:8000`, volume-mounts `./resumes` and `./data`, loads `.env`. Frontend runs separately via `npm run dev`.
- **CI:** TODO — `.github/` exists but its contents were not audited in this pass.

## Code style

- Python 3.12, type hints required on new/modified functions.
- Formatting: black. Linting: ruff.
- Functions under 50 lines; extract helpers rather than nesting.
- No new dependencies without an ADR under `argos/specs/decisions/`. Prefer stdlib or existing project deps first.
- TypeScript: follow existing patterns in `frontend/` (Next.js 14 app router, React 18, Tailwind). No formal style rules pinned yet — revisit if the frontend grows.
- Tests: no harness exists today. New behavior should include tests where practical; "no test runner" is itself a known gap worth a future ticket.

## What this architecture deliberately does not support

- **Multiple simultaneous users.** No auth, no tenant isolation, no per-user DB scoping. CORS is pinned to one origin.
- **Horizontal scale-out.** Scheduler is in-process; a second backend instance would duplicate scrapes and race writes against the same SQLite file.
- **Public-internet exposure.** No rate limiting, no CSRF protection, no HTTPS termination. Intended deploy surface is a trusted LAN.
- **Auto-apply / form-fill.** Out of scope per PRD non-goals.
- **Database portability without rework.** Two schema features are SQLite-ish today: `resume_scores.matched_keywords` / `missing_keywords` are `JSON` columns, and the whole model assumes a single-writer file. Moving to Postgres is not a drop-in.
- **LLM providers other than Gemini.** `tailor.py` imports `google.genai` directly with no abstraction layer.

## Known drift

Code-vs-docs and code-vs-code mismatches observed in this pass. Each should become an ADR or a cleanup ticket.

- **docker-compose does not build the frontend.** Only `./backend` is a service. `frontend/` has no Dockerfile. README's "Run" section treats this as intentional (two separate commands), but it means there is no one-command production start.
