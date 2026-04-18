import logging
import re
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import pandas as pd
from jobspy import scrape_jobs
from sqlalchemy.orm import Session

from config import settings
from database import get_job_by_id, list_search_terms, upsert_job
from models import Job

log = logging.getLogger(__name__)

#google (flaky dom scraping) and zip_recruiter (silently blocks datacenter ips) are excluded from production; kept in all_sites for test_sources().
FULL_SITES = ["indeed", "linkedin"]
ALL_SITES = ["indeed", "linkedin", "zip_recruiter", "google"]

STALE_DAYS = 14


def _normalize(text: str) -> str:
    return re.sub(r"[^\w]", "", text.strip().lower())


def _parse_city_state(location: str | None) -> tuple[str | None, str | None]:
    if not location:
        return None, None
    parts = [p.strip() for p in location.split(",")]
    city = parts[0] if len(parts) >= 1 else None
    state = parts[1] if len(parts) >= 2 else None
    return city, state


def _coerce_date_posted(raw) -> datetime | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if isinstance(raw, pd.Timestamp):
        return raw.to_pydatetime()
    if isinstance(raw, datetime):
        return raw
    if hasattr(raw, "year"):
        return datetime(raw.year, raw.month, raw.day)
    return None


def _row_to_dict(row: pd.Series) -> dict:
    city, state = _parse_city_state(row.get("location"))
    date_posted = _coerce_date_posted(row.get("date_posted"))

    return {
        "title": row.get("title") or "Unknown",
        "company": row.get("company") or "Unknown",
        "company_url": row.get("company_url") or None,
        "job_url": row.get("job_url") or "",
        "site": str(row.get("site", "")),
        "description": row.get("description"),
        "location": row.get("location"),
        "city": city,
        "state": state,
        "is_remote": bool(row.get("is_remote")),
        "job_type": row.get("job_type"),
        "min_salary": int(row["min_amount"]) if pd.notna(row.get("min_amount")) else None,
        "max_salary": int(row["max_amount"]) if pd.notna(row.get("max_amount")) else None,
        "date_posted": date_posted,
    }


def _site_kwargs(site: str, term: str, results_wanted: int) -> dict:
    common = {
        "site_name": [site],
        "results_wanted": results_wanted,
        "hours_old": settings.hours_old,
        "description_format": "markdown",
        "verbose": 1,
    }

    if site == "indeed":
        return {
            **common,
            "search_term": term,
            "is_remote": True,
            "country_indeed": "USA",
        }
    if site == "linkedin":
        return {
            **common,
            "search_term": term,
            "is_remote": True,
            "linkedin_fetch_description": True,
        }
    if site == "zip_recruiter":
        return {
            **common,
            "search_term": term,
            "location": "United States",
            "is_remote": True,
        }
    if site == "google":
        return {
            **common,
            "google_search_term": f"{term} jobs remote",
        }
    raise ValueError(f"unknown site: {site}")


FLAKY_SITES = {"google", "zip_recruiter"}


def drop_missing_company(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or len(df) == 0 or "company" not in df.columns:
        return df if df is not None else pd.DataFrame()
    before = len(df)
    df = df.dropna(subset=["company"])
    df = df[df["company"].astype(str).str.strip() != ""]
    dropped_count = before - len(df)
    if dropped_count > 0:
        log.info(f"dropped {dropped_count} rows with missing company")
    return df


def _scrape_one(site: str, term: str, results_wanted: int) -> pd.DataFrame:
    log.info("searching %s: %s", site, term)
    try:
        df = scrape_jobs(**_site_kwargs(site, term, results_wanted))
        df = drop_missing_company(df)
        row_count = 0 if df is None else len(df)
        if row_count == 0:
            if site in FLAKY_SITES:
                log.warning(
                    "ZERO RESULTS from site=%s term=%r (kwargs=%s) — "
                    "this site is prone to silent failures; check scraper status",
                    site,
                    term,
                    _site_kwargs(site, term, results_wanted),
                )
            else:
                log.info("  %s/%s returned 0 rows", site, term)
        else:
            log.info("  %s/%s returned %d rows", site, term, row_count)
        return df if df is not None else pd.DataFrame()
    except Exception as exc:
        log.error(
            "SCRAPE FAILED site=%s term=%r error=%s\n%s",
            site,
            term,
            exc,
            traceback.format_exc(),
        )
        return pd.DataFrame()


def fetch_jobs(
    search_terms: list[str],
    *,
    sites: list[str] | None = None,
    results_wanted: int | None = None,
) -> list[dict]:
    sites = sites or FULL_SITES
    results_wanted = results_wanted if results_wanted is not None else settings.max_results_per_source

    seen: set[str] = set()
    results: list[dict] = []
    dupes_skipped = 0

    jobs_to_run = [(site, term) for site in sites for term in search_terms]

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_scrape_one, site, term, results_wanted): (site, term)
            for site, term in jobs_to_run
        }
        for future in as_completed(futures):
            df = future.result()
            for _, row in df.iterrows():
                job_dict = _row_to_dict(row)
                job_id = Job.make_id(job_dict["title"], job_dict["company"], job_dict.get("location"))
                if job_id in seen:
                    dupes_skipped += 1
                    continue
                seen.add(job_id)
                results.append(job_dict)

    log.info("fetch complete: %d unique, %d dupes skipped", len(results), dupes_skipped)
    return results


def run_full_sync(db: Session) -> dict:
    active_terms = [t.term for t in list_search_terms(db, active_only=True)]
    if not active_terms:
        log.warning("no active search terms configured — skipping fetch")
        return {
            "total_fetched": 0,
            "new_jobs": 0,
            "dupes_skipped": 0,
            "stale_deactivated": 0,
        }

    fetched = fetch_jobs(active_terms)

    seen_ids: set[str] = set()
    new_jobs = 0

    for job_dict in fetched:
        job_id = Job.make_id(job_dict["title"], job_dict["company"], job_dict.get("location"))
        seen_ids.add(job_id)
        already_exists = get_job_by_id(db, job_id) is not None
        upsert_job(db, job_dict)
        if not already_exists:
            new_jobs += 1

    cutoff = datetime.utcnow() - timedelta(days=STALE_DAYS)
    stale_jobs = (
        db.query(Job)
        .filter(Job.id.notin_(seen_ids), Job.is_active.is_(True), Job.date_fetched < cutoff)
        .all()
    )
    for job in stale_jobs:
        job.is_active = False
    if stale_jobs:
        db.commit()
        log.info("marked %d stale jobs inactive", len(stale_jobs))

    return {
        "total_fetched": len(fetched),
        "new_jobs": new_jobs,
        "dupes_skipped": len(fetched) - len(seen_ids),
        "stale_deactivated": len(stale_jobs),
    }


def test_sources() -> None:
    """Probe each site individually with a simple search term and report."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    term = "software engineer"
    results_wanted = 10
    summary: list[tuple[str, int | None, str | None]] = []

    print(f"\n=== Testing {len(ALL_SITES)} sites with term={term!r} ===\n")

    for site in ALL_SITES:
        print(f"--- {site} ---")
        try:
            kwargs = _site_kwargs(site, term, results_wanted)
            df = scrape_jobs(**kwargs)
            count = 0 if df is None else len(df)
            print(f"  {site}: {count} results")
            summary.append((site, count, None))
        except Exception as exc:
            tb = traceback.format_exc()
            print(f"  {site}: ERROR — {exc}")
            print(tb)
            summary.append((site, None, f"{exc}\n{tb}"))

    print("\n=== Summary ===")
    for site, count, err in summary:
        if err is not None:
            print(f"  {site:15s} FAILED")
        else:
            print(f"  {site:15s} {count} results")
    print()


if __name__ == "__main__":
    test_sources()
