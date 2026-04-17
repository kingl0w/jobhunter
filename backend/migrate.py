"""one-time migration from the old IT/Dev schema to the generic multi-resume schema.

usage: python migrate.py
"""

import logging
import shutil
from pathlib import Path

from sqlalchemy import inspect, text

from config import settings
from database import engine, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


def main() -> None:
    db_path = Path(settings.db_path)
    if db_path.exists():
        backup = db_path.with_suffix(db_path.suffix + ".bak")
        shutil.copy2(db_path, backup)
        log.info("backed up %s -> %s", db_path, backup)
    else:
        log.info("no existing db at %s — fresh install", db_path)

    inspector = inspect(engine)
    with engine.begin() as conn:
        if "scores" in inspector.get_table_names():
            conn.execute(text("DROP TABLE scores"))
            log.info("dropped old scores table")
        if "resume_scores" in inspector.get_table_names():
            conn.execute(text("DROP TABLE resume_scores"))
            log.info("dropped old resume_scores table")
        if "resumes" in inspector.get_table_names():
            conn.execute(text("DROP TABLE resumes"))
            log.info("dropped old resumes table")

    init_db()
    log.info("recreated tables via init_db()")

    print()
    print("=" * 60)
    print("  Migration complete.")
    print("=" * 60)
    print("  Next steps:")
    print("    1. Start the app:  docker compose up   (or run backend + frontend)")
    print("    2. Open http://localhost:3000/settings")
    print("    3. Upload at least one resume (.docx or .pdf)")
    print("    4. Review/edit search terms")
    print("    5. Click Find Jobs on the main page")
    print("=" * 60)


if __name__ == "__main__":
    main()
