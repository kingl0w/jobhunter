import logging

from database import SessionLocal
from models import ResumeScore
from scorer import score_all_unscored

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


def main() -> None:
    db = SessionLocal()
    try:
        deleted = db.query(ResumeScore).delete()
        db.commit()
        log.info("deleted %d existing resume_score rows", deleted)

        scored = score_all_unscored(db)
        log.info("rescored %d jobs", scored)
    finally:
        db.close()


if __name__ == "__main__":
    main()
