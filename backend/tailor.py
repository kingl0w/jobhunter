import json
import logging
import os
from datetime import datetime

import google.generativeai as genai
from docx import Document
from sqlalchemy.orm import Session

from config import settings
from database import get_resume, update_application_status
from models import ResumeScore

log = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"
TAILORED_DIR = settings.tailored_resumes_dir
os.makedirs(TAILORED_DIR, exist_ok=True)

genai.configure(api_key=settings.gemini_api_key)
client = genai.GenerativeModel(MODEL)


def summarize_job(description: str) -> str:
    response = client.generate_content(
        (
            "Summarize this job posting in exactly 3 sentences and under 80 words. "
            "Sentence 1: what the role does day-to-day. "
            "Sentence 2: what tech stack and tools are required. "
            "Sentence 3: what kind of company it is. "
            "Return only the summary, no preamble.\n\n"
            f"{description}"
        ),
        generation_config={"max_output_tokens": 200},
    )
    return response.text.strip()


def _read_docx(path: str) -> Document:
    return Document(path)


def _extract_skills_section(doc: Document) -> tuple[int, int, list[str]]:
    paragraphs = doc.paragraphs
    start = None
    end = None

    for i, para in enumerate(paragraphs):
        text = para.text.strip().lower()
        is_heading = para.style.name.lower().startswith("heading")
        is_bold_line = all(run.bold for run in para.runs if run.text.strip()) and para.runs

        if (is_heading or is_bold_line) and "skill" in text:
            start = i + 1
            continue

        if start is not None and (is_heading or is_bold_line) and text:
            end = i
            break

    if start is None:
        return -1, -1, []

    if end is None:
        end = len(paragraphs)

    skill_lines = [
        paragraphs[i].text
        for i in range(start, end)
        if paragraphs[i].text.strip()
    ]
    return start, end, skill_lines


def _replace_skills_section(doc: Document, start: int, end: int, new_lines: list[str]) -> Document:
    paragraphs = doc.paragraphs

    first_skill_para = paragraphs[start] if start < len(paragraphs) else None
    template_run = None
    if first_skill_para and first_skill_para.runs:
        template_run = first_skill_para.runs[0]

    for i in range(end - 1, start - 1, -1):
        para_element = paragraphs[i]._element
        para_element.getparent().remove(para_element)

    insert_point = paragraphs[start - 1]._element if start > 0 else doc.element.body[0]

    for line in reversed(new_lines):
        new_para = doc.add_paragraph()
        new_run = new_para.add_run(line)

        if template_run:
            new_run.bold = template_run.bold
            new_run.italic = template_run.italic
            new_run.underline = template_run.underline
            if template_run.font.size:
                new_run.font.size = template_run.font.size
            if template_run.font.name:
                new_run.font.name = template_run.font.name

        new_element = new_para._element
        new_element.getparent().remove(new_element)
        insert_point.addnext(new_element)

    return doc


def tailor_resume(
    job_id: str,
    description: str,
    resume_id: str,
    db: Session,
) -> str:
    resume = get_resume(db, resume_id)
    if not resume:
        raise ValueError(f"resume not found: {resume_id}")

    base_path = resume.file_path
    if not os.path.isfile(base_path):
        log.error("base resume file missing: %s", base_path)
        raise FileNotFoundError(base_path)

    if not base_path.lower().endswith(".docx"):
        log.warning("tailoring only supported for .docx, returning base: %s", base_path)
        return base_path

    score_row = (
        db.query(ResumeScore)
        .filter(ResumeScore.job_id == job_id, ResumeScore.resume_id == resume_id)
        .first()
    )
    missing_keywords = (score_row.missing_keywords if score_row else []) or []

    doc = _read_docx(base_path)
    start, end, current_skill_lines = _extract_skills_section(doc)

    if start == -1 or not current_skill_lines:
        log.warning("no skills section found in %s, returning base resume", base_path)
        return base_path

    prompt = (
        "You are a resume tailoring assistant. Your job is to subtly update the "
        "skills section of a resume so it better matches a job posting.\n\n"
        "RULES:\n"
        "- Only modify the skill keyword lines below.\n"
        "- Incorporate the missing keywords where they fit naturally.\n"
        "- Do NOT invent skills the candidate doesn't have — only reword, "
        "reorder, or add keywords that are reasonable synonyms or related.\n"
        "- Do NOT change job titles, company names, dates, or metrics.\n"
        "- Keep the same number of lines and similar line lengths.\n"
        "- Return ONLY a JSON object with key \"updated_skills_lines\" containing "
        "a list of strings, one per skill category line.\n\n"
        f"JOB DESCRIPTION:\n{description}\n\n"
        f"CURRENT SKILLS LINES:\n{json.dumps(current_skill_lines)}\n\n"
        f"MISSING KEYWORDS TO INCORPORATE:\n{json.dumps(missing_keywords)}\n\n"
        "Respond with only the JSON object, no markdown fences or extra text."
    )

    response = client.generate_content(
        prompt,
        generation_config={"max_output_tokens": 1024},
    )
    raw_text = response.text.strip()

    try:
        parsed = json.loads(raw_text)
        updated_lines = parsed["updated_skills_lines"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        log.error("failed to parse gemini response: %s\nraw: %s", exc, raw_text[:500])
        return base_path

    if not isinstance(updated_lines, list) or not all(isinstance(s, str) for s in updated_lines):
        log.error("unexpected response shape: %s", type(updated_lines))
        return base_path

    tailored_doc = _read_docx(base_path)
    _replace_skills_section(tailored_doc, start, end, updated_lines)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    short_id = job_id[:12]
    label_slug = "".join(c if c.isalnum() else "_" for c in (resume.label or "resume")).strip("_")[:40]
    filename = f"{short_id}_{label_slug}_{timestamp}.docx"
    output_path = os.path.join(TAILORED_DIR, filename)
    tailored_doc.save(output_path)

    log.info("tailored resume saved: %s", output_path)

    update_application_status(db, job_id, resume_used=output_path)

    return output_path
