from scorer import _clean_skill_fragment, extract_keywords, score_resume


def test_keyword_extraction_separates_hard_and_soft():
    desc = """
    Required:
    - Python
    - Postgres
    - Kubernetes

    Nice to have:
    - Go
    - Terraform
    """
    kw = extract_keywords(desc)
    assert "python" in kw["hard"]
    assert "postgresql" in kw["hard"]
    assert "kubernetes" in kw["hard"]
    assert "go" in kw["soft"]
    assert "terraform" in kw["soft"]


def test_synonyms_normalize_in_extraction():
    kw = extract_keywords("Required:\n- k8s\n- postgres\n- ts")
    assert "kubernetes" in kw["hard"]
    assert "postgresql" in kw["hard"]
    assert "typescript" in kw["hard"]


def test_score_resume_matches_hard_skills():
    keywords = {"hard": ["python", "postgresql"], "soft": ["go"], "all": ["python", "postgresql", "go"]}
    score, matched, missing = score_resume("I write python and postgresql daily", keywords)
    assert "python" in matched
    assert "postgresql" in matched
    assert "go" in missing
    assert score > 50


def test_clean_skill_fragment_drops_filler():
    assert _clean_skill_fragment("experience with python") == "python"
    assert _clean_skill_fragment("strong knowledge of aws") == "aws"
