import logging
import math
import os
import re

from docx import Document
from sqlalchemy.orm import Session

from database import upsert_resume_score
from models import Job, Resume, ResumeScore

log = logging.getLogger(__name__)

SYNONYM_MAP: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "psql": "postgresql",
    "k8s": "kubernetes",
    "node": "node.js",
    "react.js": "react",
    "reactjs": "react",
    "nextjs": "next.js",
    "vuejs": "vue",
    "vue.js": "vue",
    "ms sql": "sql server",
    "mssql": "sql server",
    "mongo": "mongodb",
    "gcp": "google cloud",
    "amazon web services": "aws",
    "ci/cd": "cicd",
    "ci cd": "cicd",
    "dotnet": ".net",
    "c#": "csharp",
    "cpp": "c++",
    "py": "python",
    "tf": "terraform",
    "ad": "active directory",
    "o365": "office 365",
    "m365": "microsoft 365",
    "win server": "windows server",
}

HARD_SECTION_PATTERN = re.compile(
    r"(require[ds]?|must[\s-]have|minimum|mandatory|essential|qualifications)",
    re.IGNORECASE,
)
SOFT_SECTION_PATTERN = re.compile(
    r"(prefer(?:red)?|nice[\s-]to[\s-]have|bonus|desired|a[\s-]plus|optional)",
    re.IGNORECASE,
)
BULLET_PREFIX = re.compile(r"^[\s]*[-*•▪●]\s*", re.MULTILINE)
CICD_PATTERN = re.compile(r"\bci\s*/\s*cd\b", re.IGNORECASE)
FRAGMENT_SPLIT = re.compile(r"[,;\n]|\band\b|\bor\b", re.IGNORECASE)

STOP_PHRASES = (
    "experience with",
    "ability to",
    "knowledge of",
    "must have",
    "required",
    "preferred",
    "including",
    "such as",
    "we are",
    "you will",
    "the ability",
    "a strong",
)

FILLER_WORDS = re.compile(
    r"\b("
    r"experience|knowledge|familiarity|proficiency|understanding"
    r"|strong|solid|deep|hands[\s-]?on|proven|working|expertise"
    r"|with|of|in|and|or|a|the|an|is|are|to|for|on|at|by|from"
    r"|using|e\.?g\.?"
    r"|years?|yrs?|\d+\+?"
    r"|pipelines?|tools?|services?|platforms?|systems?"
    r"|environment|stack|concepts?|practices?"
    r"|methodolog(?:y|ies)|frameworks?"
    r")\b",
    re.IGNORECASE,
)


def load_resume_text(path: str) -> str:
    if not path or not os.path.isfile(path):
        log.warning("resume not found at %s", path)
        return ""

    ext = os.path.splitext(path)[1].lower()
    if ext == ".docx":
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            log.error("pypdf not installed; cannot read pdf %s", path)
            return ""
        reader = PdfReader(path)
        return "\n".join((page.extract_text() or "") for page in reader.pages)

    log.warning("unsupported resume format: %s", ext)
    return ""


def _normalize_term(term: str) -> str:
    lowered = term.strip().lower()

    if lowered in SYNONYM_MAP:
        return SYNONYM_MAP[lowered]

    words = lowered.split()
    resolved = [SYNONYM_MAP.get(w, w) for w in words]
    deduplicated = list(dict.fromkeys(resolved))
    return " ".join(deduplicated)


def _is_section_header(line: str) -> bool:
    stripped = line.strip().strip("#").strip("*").strip()
    if not stripped or len(stripped) >= 80:
        return False
    if BULLET_PREFIX.match(line):
        return False
    return stripped.endswith(":") or stripped.isupper()


def _split_sections(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_header = ""
    current_body: list[str] = []

    for line in text.split("\n"):
        if _is_section_header(line):
            if current_body:
                sections.append((current_header, "\n".join(current_body)))
            current_header = line.strip().strip("#").strip("*").strip()
            current_body = []
        else:
            current_body.append(line)

    if current_body:
        sections.append((current_header, "\n".join(current_body)))

    return sections


def _clean_skill_fragment(fragment: str) -> str | None:
    cleaned = fragment.strip().lower()
    if not cleaned or len(cleaned) > 60:
        return None

    for phrase in STOP_PHRASES:
        cleaned = cleaned.replace(phrase, " ")

    cleaned = FILLER_WORDS.sub(" ", cleaned)
    cleaned = re.sub(r"[^a-zA-Z0-9.+#\s-]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip("-+").strip()

    if len(cleaned) < 2 or len(cleaned) > 30:
        return None

    word_count = len(cleaned.split())
    if word_count < 1 or word_count > 4:
        return None

    return _normalize_term(cleaned)


def extract_keywords(text: str) -> dict[str, list[str]]:
    if not text:
        return {"hard": [], "soft": [], "all": []}

    hard: list[str] = []
    soft: list[str] = []
    ungrouped: list[str] = []

    for header, body in _split_sections(text):
        body = CICD_PATTERN.sub("cicd", body)
        body = BULLET_PREFIX.sub("\n", body)

        skills: list[str] = []
        for fragment in FRAGMENT_SPLIT.split(body):
            skill = _clean_skill_fragment(fragment)
            if skill:
                skills.append(skill)

        if HARD_SECTION_PATTERN.search(header):
            hard.extend(skills)
        elif SOFT_SECTION_PATTERN.search(header):
            soft.extend(skills)
        else:
            ungrouped.extend(skills)

    if not hard:
        hard = ungrouped

    hard = list(dict.fromkeys(hard))
    soft = list(dict.fromkeys(s for s in soft if s not in hard))

    return {
        "hard": hard,
        "soft": soft,
        "all": list(dict.fromkeys(hard + soft)),
    }


def score_resume(
    resume_text: str,
    keywords: dict[str, list[str]],
) -> tuple[float, list[str], list[str]]:
    resume_normalized = _normalize_term(resume_text)
    matched: list[str] = []
    missing: list[str] = []

    hard = keywords.get("hard", [])
    soft = keywords.get("soft", [])
    max_points = len(hard) * 2 + len(soft) * 1

    if max_points == 0:
        return 50.0, [], []

    points = 0.0
    for kw in hard:
        if _normalize_term(kw) in resume_normalized:
            points += 2
            matched.append(kw)
        else:
            missing.append(kw)

    for kw in soft:
        if _normalize_term(kw) in resume_normalized:
            points += 1
            matched.append(kw)
        else:
            missing.append(kw)

    percentage = round((points / max_points) * 100, 2)
    return percentage, matched, missing


def score_job(
    job_id: str,
    description: str,
    resumes: list[Resume],
    db: Session,
    title: str = "",
) -> list[ResumeScore]:
    keywords = extract_keywords(description or "")
    results: list[ResumeScore] = []

    title_lower = (title or "").lower()
    title_words = set(re.findall(r"[a-z]+", title_lower))

    for resume in resumes:
        raw_score, matched, missing = score_resume(resume.extracted_text or "", keywords)

        label_words = set(re.findall(r"[a-z]+", (resume.label or "").lower()))
        if label_words and (title_words & label_words):
            raw_score = min(100.0, raw_score + 10)

        if len(keywords["all"]) < 5:
            raw_score *= 0.7

        final_score = round(math.sqrt(max(raw_score, 0.0) / 100) * 100, 2)

        record = upsert_resume_score(db, {
            "job_id": job_id,
            "resume_id": resume.id,
            "score": final_score,
            "matched_keywords": matched,
            "missing_keywords": missing,
        })
        results.append(record)

    log.info(
        "scored %r: kw=%d hard=%d soft=%d resumes=%d",
        title or job_id,
        len(keywords["all"]),
        len(keywords["hard"]),
        len(keywords["soft"]),
        len(resumes),
    )

    return results


def score_all_unscored(db: Session) -> int:
    resumes = db.query(Resume).all()
    if not resumes:
        log.warning("no resumes uploaded — skipping scoring")
        return 0

    resume_ids = [r.id for r in resumes]

    jobs = (
        db.query(Job)
        .filter(Job.description.isnot(None))
        .all()
    )

    scored = 0
    for job in jobs:
        existing_ids = {
            rs.resume_id
            for rs in db.query(ResumeScore)
            .filter(ResumeScore.job_id == job.id, ResumeScore.resume_id.in_(resume_ids))
            .all()
        }
        missing_resumes = [r for r in resumes if r.id not in existing_ids]
        if not missing_resumes:
            continue

        try:
            score_job(job.id, job.description, missing_resumes, db, title=job.title)
            scored += 1
        except Exception:
            log.exception("failed to score job %s", job.id)

    log.info("scored %d jobs against %d resumes", scored, len(resumes))
    return scored


def rescore_all_for_resume(db: Session, resume: Resume) -> int:
    jobs = (
        db.query(Job)
        .filter(Job.description.isnot(None))
        .all()
    )
    scored = 0
    for job in jobs:
        try:
            score_job(job.id, job.description, [resume], db, title=job.title)
            scored += 1
        except Exception:
            log.exception("failed to score job %s", job.id)
    return scored
