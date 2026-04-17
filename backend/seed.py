"""seed the database with a small fetch from indeed only.

run with: python seed.py
"""

import logging

from jobspy import scrape_jobs

from database import SessionLocal, init_db, upsert_job
from fetcher import _row_to_dict, drop_missing_company
from models import Job
from scorer import score_all_unscored

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


def main():
    init_db()
    db = SessionLocal()

    log.info("fetching 5 results from indeed...")
    df = scrape_jobs(
        site_name=["indeed"],
        search_term="systems engineer",
        location="Remote",
        is_remote=True,
        results_wanted=5,
        hours_old=72,
        description_format="markdown",
        country_indeed="USA",
    )
    log.info("got %d rows", len(df))
    df = drop_missing_company(df)

    new_count = 0
    for _, row in df.iterrows():
        job_dict = _row_to_dict(row)
        job_id = Job.make_id(job_dict["title"], job_dict["company"], job_dict.get("location"))
        if db.get(Job, job_id) is None:
            new_count += 1
        upsert_job(db, job_dict)

    log.info("upserted %d jobs (%d new)", len(df), new_count)

    scored = score_all_unscored(db)
    log.info("scored %d jobs", scored)

    db.close()
    log.info("done")


if __name__ == "__main__":
    main()
