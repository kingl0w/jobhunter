# jobhunter — Product Requirements

**Created:** 2026-04-24
**Status:** Draft
**Owner:** Ian

## One-line pitch

Self-hosted job hunting dashboard with automated scraping, scoring, and resume tailoring.

## Problem

Job board aggregators (LinkedIn, Indeed) bury remote IT/dev roles under location-unfiltered noise. Manually sifting every day to find genuinely remote roles that match my skill set is slow, repetitive, and lossy — relevant postings get missed, irrelevant ones cost time, and the same job appears three times across sources.

## Target user

One: Ian (me). Secondary: anyone who forks the repo to run it for themselves. Not a product for multiple simultaneous users.

## Goals

What the product does (distinct from how we measure success — see Success metrics):

1. Scrape remote IT/dev postings from multiple job boards on a schedule (APScheduler, default 6h) and on demand via `POST /sync`. Production sources: Indeed, LinkedIn. Disabled/flaky sources kept in code: Google, ZipRecruiter.
2. Deduplicate postings across sources using a deterministic job ID: `SHA256(title|company|location)` (`Job.make_id` in `backend/models.py`).
3. Score each posting against each uploaded resume via keyword + `SYNONYM_MAP` matching (`backend/scorer.py`). Surface matched_keywords and missing_keywords alongside the numeric score.
4. Generate per-job tailored resumes on demand using Gemini (`gemini-2.5-flash` via `google-genai`). Ground the output against the base `.docx` so keywords not present in the source resume cannot be fabricated (`ground_check_keywords` in `backend/tailor.py`).
5. Track application state per job through a fixed state machine: `saved | applied | phone_screen | interview | offer | rejected` (`APPLICATION_STATUSES` in `backend/models.py`).
6. Expose all of the above through a single-user local web UI (Next.js 14.2 app router at `frontend/app/`).

## Non-goals

- Multi-user / SaaS. jobhunter is a single-user, self-hosted tool. No auth, no tenancy, no public-facing deployment. If multi-user ever matters, it's a fork, not a feature.
- Auto-apply. jobhunter surfaces and tailors; the human clicks submit.
- Full ATS replacement. No interview scheduling, no CRM-style pipeline features beyond the minimal applied/status tracking that already exists.

## Success metrics

Ranked by priority:

1. Land a remote role via a jobhunter-sourced posting.
2. Scoring precision: top-20 scored jobs each week genuinely look worth applying to (low false-positive rate on the scorer).
3. Runs unattended on hserver-1 for 30+ days with zero manual intervention (scraper + scheduler stable, no crashes, no DB bloat).
4. Public repo picks up forks or stars — minimum bar for "others find it useful."
5. Becomes the daily-check tool, replacing direct LinkedIn/Indeed use.

## Constraints

- **Technical:** Python 3.12 backend (FastAPI, SQLAlchemy, APScheduler, python-jobspy, google-genai, python-docx, pypdf). Next.js 14.2 / React 18 / TypeScript / Tailwind 3.4 frontend. SQLite in WAL mode as the only datastore.
- **Performance envelope:** single-user latency only; APScheduler and background sync run in-process inside uvicorn. No separate worker process.
- **External:** Gemini API quota (429 surfaces as HTTP 429/503 with a pointer to AI Studio rate-limit docs). python-jobspy rate limits on Indeed/LinkedIn — mitigated only by `results_wanted` (default 25) and `hours_old` (default 72) caps.
- **Deploy target:** localhost. CORS allow-list is hard-pinned to `http://localhost:3000`. `docker-compose.yml` builds the backend only; the frontend runs bare via `npm run dev`.
- **Resource:** solo project, no deadline, no budget beyond Gemini free-tier quota.

## Open questions

- [ ] Should the scorer move from keyword+synonym matching to LLM-based scoring? (Currently keyword-only; the README's "scoring" claim implies LLM but the code does not.) Would need an ADR for cost/latency/determinism tradeoff.
- [ ] Formal test harness. No `tests/` directory exists under `backend/` or `frontend/`, and no test runner is pinned in `requirements.txt` or `package.json`. Worth a follow-up ticket to pick pytest + something for the frontend.
- [ ] Migration framework. Today `init_db()` calls `create_all`; `backend/migrate.py` is a one-off for a historical cutover. First schema change that isn't purely additive will force this decision.
- [ ] Should disabled sources (Google, ZipRecruiter) be removed from the frontend source filter, or should the scraper re-enable them behind a flag? Current state: UI exposes filters for sources that are never scraped in production (`fetcher.py` `FULL_SITES`).

## Out-of-band context

- Intended deploy target is a home server ("hserver-1" — see Success metrics). The repo does not yet contain deployment artifacts for it; current docker-compose assumes the operator runs it interactively on localhost.
- The codebase shows evidence of a prior "IT / Dev resume" schema (see `backend/migrate.py` docstring, and dead `IT_RESUME_PATH` / `DEV_RESUME_PATH` entries in `.env.example`). The current schema is generic multi-resume; any references to two hardcoded resume slots are historical.
