import io

from docx import Document


def _make_docx(text: str) -> bytes:
    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _upload(client, label: str, content: bytes | None = None) -> dict:
    if content is None:
        content = _make_docx(f"resume body for {label}")
    r = client.post(
        "/resumes",
        data={"label": label},
        files={"file": (f"{label}.docx", io.BytesIO(content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_resumes_are_user_scoped(client):
    client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    ian_resume = _upload(client, "ian-cv")
    assert len(client.get("/resumes").json()) == 1

    client.post("/auth/logout")
    client.post("/auth/login", json={"app_password": "testpass", "username": "buddy"})
    assert client.get("/resumes").json() == []

    # buddy uploads
    buddy_resume = _upload(client, "buddy-cv")
    assert len(client.get("/resumes").json()) == 1

    # buddy cannot delete ian's resume
    r = client.delete(f"/resumes/{ian_resume['id']}")
    assert r.status_code == 404

    # buddy cannot read ian's resume via download even if path leaks
    # (covered by user_id filter in get_resume; no direct GET /resumes/{id} endpoint exists)


def test_application_status_is_user_scoped(client):
    from database import SessionLocal
    from models import Job

    # seed a shared job directly
    db = SessionLocal()
    job = Job(
        id=Job.make_id("Engineer", "Acme", "Remote"),
        title="Engineer",
        company="Acme",
        job_url="https://example.com/job",
        site="indeed",
        description="we use python",
        is_remote=True,
    )
    db.add(job)
    db.commit()
    job_id = job.id
    db.close()

    client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    r = client.patch(f"/jobs/{job_id}/status", json={"status": "applied", "notes": "ian note"})
    assert r.status_code == 200

    body = client.get(f"/jobs/{job_id}").json()
    assert body["application"]["status"] == "applied"
    assert body["application"]["notes"] == "ian note"

    client.post("/auth/logout")
    client.post("/auth/login", json={"app_password": "testpass", "username": "buddy"})
    body = client.get(f"/jobs/{job_id}").json()
    assert body["application"] is None, "buddy must not see ian's application"


def test_search_terms_are_global_but_authed(client):
    client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    ian_terms = client.get("/search-terms").json()
    assert len(ian_terms) >= 1

    client.post("/auth/logout")
    client.post("/auth/login", json={"app_password": "testpass", "username": "buddy"})
    buddy_terms = client.get("/search-terms").json()
    assert len(buddy_terms) == len(ian_terms), "search terms are intentionally shared"
