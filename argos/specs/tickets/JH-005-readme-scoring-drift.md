# JH-005: Fix README scoring drift — clarify keyword matching, not LLM

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** S

## Intent

Update `README.md` so its description of scoring accurately reflects the code: keyword + synonym matching (`backend/scorer.py`), not LLM-based scoring. Tailoring and summarization (`backend/tailor.py`) are LLM-based and should continue to be described that way.

## Context

`ARCHITECTURE.md` "Known drift" entry: README's setup instructions imply LLM-based scoring (the now-fixed "AI API key" framing suggested all AI flows used a single key, including scoring). Code reality: `backend/scorer.py` is regex + `SYNONYM_MAP` keyword matching. Only `backend/tailor.py` calls the LLM (Gemini), and only for tailoring and summarization — never for scoring.

A user reading the README might expect LLM-quality scoring and be surprised when results are keyword-driven. The README should set correct expectations.

## Scope

- Read `README.md` and identify any prose that describes how scoring works or implies LLM-based scoring.
- Update those sections to accurately describe the scoring as keyword + synonym matching (e.g. "scores postings against your resume using keyword and synonym matching" or similar — keep the README's existing voice).
- If the README has a "How it works" or "Features" section that lists scoring as an AI/LLM feature, correct it.
- Tailoring (Gemini) and summarization (Gemini) are correctly LLM-based and should keep being described as such.

## Non-goals

- Do **not** modify `backend/scorer.py`, `backend/tailor.py`, or any source code — code is already correct.
- Do **not** update `ARCHITECTURE.md`'s Known drift section — deferred to Phase 1 closeout (next ticket).

## Acceptance criteria (draft — planner will refine)

- `grep -n -i -E "ai.scor|llm.scor|gemini.scor|claude.scor|smart.scor" README.md` returns no results (no language implying LLM-based scoring).
- README still mentions Gemini in the context of tailoring/summarization if it does today (don't accidentally erase correct LLM mentions).
- README renders correctly on GitHub (no broken markdown).
- `git diff --stat` shows ONLY `README.md` modified (plus ticket and STATE).
- `backend/` and `frontend/` unchanged.

## Plan

### Files touched

- `README.md` (edit) — only file modified.

### Code reality (for grounding the replacement copy)

- `backend/scorer.py` is non-LLM: it extracts skill fragments from the JD via regex (`HARD_SECTION_PATTERN`, `SOFT_SECTION_PATTERN`, `FRAGMENT_SPLIT`, `BULLET_PREFIX`), normalizes them through `SYNONYM_MAP` (e.g. `js` → `javascript`, `k8s` → `kubernetes`), and substring-matches the normalized terms against the resume text loaded from `.docx`/`.pdf`. Score is a square-rooted hard-vs-soft weighted ratio (`score_resume`, `score_job`), with a small title-overlap bonus and a low-keyword penalty.
- `backend/tailor.py` is the only module that calls Gemini (`gemini-2.5-flash` via `google-genai`). It exposes two LLM features: `summarize_job` (3-sentence ≤80-word summary) and `tailor_resume` (rewrites the skills section of a base `.docx`, gated by `ground_check_keywords` to prevent fabrication). The `GEMINI_API_KEY` is required for these features only.

### Changes per file

#### `README.md` — edit

The drift in this README is subtle: it never explicitly claims "AI-powered scoring", but the line `Edit \`.env\` and add your AI API key:` (line 11) immediately under a tagline that bundles scoring with tailoring (line 3) implies the same key powers both. Two surgical edits resolve this without rewriting the section.

**Edit 1 — line 3 (tagline).** Make the mechanism for scoring explicit so it can't be conflated with tailoring.

Find (exact, line 3):

```
Fetches remote job postings from multiple boards, scores them against your resumes, and generates tailored resumes for the best matches. Built with FastAPI, and Next.js
```

Replace with:

```
Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Built with FastAPI, and Next.js
```

Rationale: keeps the original sentence shape and voice; adds a 4-word qualifier on scoring ("via keyword and synonym matching") and a 2-word qualifier on tailoring ("using Gemini") so the AI/non-AI split is unambiguous from the first sentence. Does not introduce a new section.

**Edit 2 — line 11 (setup blurb above the env key).** Tie the API key to the features that actually use it.

Find (exact, line 11):

```
Edit `.env` and add your AI API key:
```

Replace with:

```
Edit `.env` and add your Gemini API key (used for resume tailoring and job summarization — scoring runs locally without an LLM):
```

Rationale: replaces the vague "AI API key" framing flagged in the ticket, names Gemini explicitly (which the env var on the next line already does), scopes the key to the two features that need it, and explicitly disclaims scoring. Single line, no list, preserves the README's setup flow.

**No other edits.** Lines 51-52 ("match scores against both resumes" / "keyword breakdown") are correct or unrelated. Line 14 (`GEMINI_API_KEY=...`) is correct and stays. Lines 17-62 (Resumes, Run, Usage, Seed data) make no scoring/LLM claims and are not touched.

### Acceptance criteria

All commands run from the repo root. Pass conditions are stated explicitly per check.

1. **No language implying LLM-based scoring** (ticket-specified, broadened):
   ```
   grep -n -i -E "ai.scor|llm.scor|gemini.scor|claude.scor|smart.scor|ai.api.key|ai.match|llm.match|ai.powered|ml.scor|embedding" README.md
   ```
   Pass: exit code 1, no output. (Broadened from the ticket draft to also catch `ai.api.key` — the exact phrase being removed — plus `ai.powered`, `ml.scor`, and `embedding` as defensive nets even though the current README contains none of those.)

2. **New scoring-mechanism wording is present:**
   ```
   grep -n -F "keyword and synonym matching" README.md
   ```
   Pass: exit code 0, exactly one match on line 3.

3. **New tailoring-key disclaimer is present:**
   ```
   grep -n -F "scoring runs locally without an LLM" README.md
   ```
   Pass: exit code 0, exactly one match on line 11.

4. **Gemini mentions preserved/expanded** (don't accidentally erase the correct LLM mention):
   ```
   grep -n -i "gemini" README.md
   ```
   Pass: exit code 0, at least 2 matches (line 3 in the new tagline, line 11 in the new setup blurb, and line 14 `GEMINI_API_KEY=...` unchanged). Pre-edit baseline was 1 match (line 14); post-edit must be ≥ 3.

5. **`GEMINI_API_KEY` env var line untouched:**
   ```
   grep -n -F "GEMINI_API_KEY=..." README.md
   ```
   Pass: exit code 0, exactly one match on line 14.

6. **No unrelated code changes:**
   ```
   git diff --stat
   ```
   Pass: only `README.md`, `argos/specs/tickets/JH-005-readme-scoring-drift.md`, and `argos/specs/STATE.md` appear in the stat. `backend/` and `frontend/` must not appear.

7. **Markdown sanity — no broken inline-code or link syntax:**
   ```
   python3 -c "import re,sys; t=open('README.md').read(); ticks=t.count('\`'); assert ticks%2==0, f'unbalanced backticks: {ticks}'; assert t.count('[')==t.count(']'), 'unbalanced brackets'; assert t.count('(')==t.count(')'), 'unbalanced parens'; print('ok')"
   ```
   Pass: prints `ok` and exit code 0. (Catches stray `]`, `)`, or unclosed `\`` from the edit.)

8. **Render smoke check** — open the GitHub render of `README.md` after push; both edits should appear inline in their original sections (tagline paragraph, Setup section), with no orphaned punctuation or broken code fences. Manual verification only.

### Test strategy

No test harness exists in the repo (PRD Open question #2). Verification is the grep/diff suite above, run as a single block:

```
grep -n -i -E "ai.scor|llm.scor|gemini.scor|claude.scor|smart.scor|ai.api.key|ai.match|llm.match|ai.powered|ml.scor|embedding" README.md ; \
grep -n -F "keyword and synonym matching" README.md ; \
grep -n -F "scoring runs locally without an LLM" README.md ; \
grep -n -i "gemini" README.md ; \
grep -n -F "GEMINI_API_KEY=..." README.md ; \
git diff --stat ; \
python3 -c "import re,sys; t=open('README.md').read(); ticks=t.count('\`'); assert ticks%2==0; assert t.count('[')==t.count(']'); assert t.count('(')==t.count(')'); print('md-ok')"
```

The verifier should quote real stdout for each command in the Verification section per Argos rules (no "should pass").

### Open questions

None. The two passages are unambiguous and the replacements preserve the README's existing voice. There is no Features section, badge list, or quick-start re-statement of features that would need lockstep updates.

### Out-of-scope reminders (from Non-goals)

- Do **not** modify `backend/scorer.py`, `backend/tailor.py`, or any source code.
- Do **not** update `ARCHITECTURE.md` "Known drift" section — deferred to a Phase 1 closeout ticket.
- Do **not** "fix" line 51's stale "both resumes" wording (multi-resume is N, not 2). That is adjacent drift unrelated to the scoring/LLM conflation this ticket addresses; file a separate ticket if desired.
- Do **not** add a Features section, How-it-works section, or architecture diagram. The ticket is a prose correction, not a doc expansion.
- Do **not** add new dependencies; this is a docs-only change.

## Verification

**Verified:** 2026-04-26
**Verifier:** Argos verifier subagent

Each acceptance command was run from the repo root. Real stdout is quoted below.

### 1. No language implying LLM-based scoring

Command:

```
grep -n -i -E "ai.scor|llm.scor|gemini.scor|claude.scor|smart.scor|ai.api.key|ai.match|llm.match|ai.powered|ml.scor|embedding" README.md
```

stdout: (empty)
exit code: 1

**PASS** — no matches; the broadened pattern (including the removed `ai.api.key` phrase) finds nothing in README.md.

### 2. New scoring-mechanism wording present

Command:

```
grep -n -F "keyword and synonym matching" README.md
```

stdout:

```
3:Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Built with FastAPI, and Next.js
```

exit code: 0

**PASS** — exactly one match on line 3, in the tagline as planned.

### 3. New tailoring-key disclaimer present

Command:

```
grep -n -F "scoring runs locally without an LLM" README.md
```

stdout:

```
11:Edit `.env` and add your Gemini API key (used for resume tailoring and job summarization — scoring runs locally without an LLM):
```

exit code: 0

**PASS** — exactly one match on line 11, in the setup blurb as planned.

### 4. Gemini mentions preserved/expanded

Command:

```
grep -n -i "gemini" README.md
```

stdout:

```
3:Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Built with FastAPI, and Next.js
11:Edit `.env` and add your Gemini API key (used for resume tailoring and job summarization — scoring runs locally without an LLM):
14:GEMINI_API_KEY=...
```

exit code: 0

**PASS** — 3 matches (lines 3, 11, 14); pre-edit baseline of 1 match (line 14) is now 3, satisfying the ≥2 (and ≥3) threshold. The correct LLM mention was not erased.

### 5. `GEMINI_API_KEY` env var line untouched

Command:

```
grep -n -F "GEMINI_API_KEY=..." README.md
```

stdout:

```
14:GEMINI_API_KEY=...
```

exit code: 0

**PASS** — exactly one match on line 14; line not touched by edits.

### 6. No unrelated code changes

Command:

```
git diff --stat
```

stdout:

```
 README.md            | 4 ++--
 argos/specs/STATE.md | 2 +-
 2 files changed, 3 insertions(+), 3 deletions(-)
```

exit code: 0

**PASS** — only `README.md` and `argos/specs/STATE.md` modified. The ticket file `argos/specs/tickets/JH-005-readme-scoring-drift.md` is untracked (new file, expected). `backend/` and `frontend/` do not appear. The untracked `jobhunter/` directory is pre-existing Windows/WSL design handoff scratch (verified by watchdog) and ignored.

### 7. Markdown sanity

Command:

```
python3 -c "t=open('README.md').read(); assert t.count('\`')%2==0; assert t.count('[')==t.count(']'); assert t.count('(')==t.count(')'); print('md-ok')"
```

stdout:

```
md-ok
```

exit code: 0

**PASS** — backticks balanced, brackets balanced, parens balanced.

### 8. Render smoke check (manual)

Manual gate per ticket. Not executed by the verifier; user should open the GitHub render after push and confirm both edits appear inline (line 3 tagline; line 11 setup blurb) with no orphaned punctuation or broken code fences. Not blocking.

### Diff inspection (semantic)

Inspected `git diff README.md` directly to confirm the edits match the plan word-for-word:

```
@@ -1,6 +1,6 @@
 # jobhunter

-Fetches remote job postings from multiple boards, scores them against your resumes, and generates tailored resumes for the best matches. Built with FastAPI, and Next.js
+Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Built with FastAPI, and Next.js

 ## Setup

@@ -8,7 +8,7 @@
 cp .env.example .env
 ```

-Edit `.env` and add your AI API key:
+Edit `.env` and add your Gemini API key (used for resume tailoring and job summarization — scoring runs locally without an LLM):

 ```
 GEMINI_API_KEY=...
```

Both edits match the plan exactly. The "AI API key" phrase that drove the drift is gone; the scoring mechanism is now named on line 3; the API key's scope is now narrowed and disclaimed on line 11. No unintended hunks.

### Regression scan

This is a docs-only change to `README.md`. No functions, modules, or callable surfaces were modified, so there are no callers to scan. No test harness exists in the repo (PRD Open question #2); the grep/diff suite above is the verification surface. `backend/` and `frontend/` are unchanged per criterion 6.

### Stale ARCHITECTURE.md drift entry (flagged, not edited)

`argos/specs/ARCHITECTURE.md` line 126 still reads:

> **README scoring claim.** README implies scoring is part of the "AI" flow (single `ANTHROPIC_API_KEY` suggests LLM everywhere). Code reality: `backend/scorer.py` is regex + `SYNONYM_MAP`; only `tailor.py` calls the LLM.

This entry is now stale — the README no longer implies LLM scoring. Per ticket Non-goals it is **not edited here**; deferred to Phase 1 closeout (JH-006), which will sweep all four resolved drift entries:

- Line 124 — JH-001 (README key)
- Line 125 — JH-002 (docker-compose `DATABASE_URL`)
- Line 126 — JH-005 (README scoring) ← this ticket
- Line 127 — JH-003 (`.env` dead vars)
- Line 128 — JH-004 (frontend source filter)

### Acceptance criteria summary

| # | Criterion | Result |
|---|-----------|--------|
| 1 | No LLM-scoring language | PASS |
| 2 | "keyword and synonym matching" present | PASS |
| 3 | "scoring runs locally without an LLM" present | PASS |
| 4 | Gemini mentions preserved/expanded (≥2) | PASS (3 matches) |
| 5 | `GEMINI_API_KEY=...` untouched | PASS |
| 6 | Only README.md + STATE.md + ticket modified | PASS |
| 7 | Markdown sanity (balanced backticks/brackets/parens) | PASS |
| 8 | GitHub render smoke check | MANUAL — not blocking |

### Status: READY

### Proposed STATE.md diff (parent applies)

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@

 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.

-- [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
+- _none_

 ## In progress

@@ -25,6 +25,7 @@

 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.

+- 2026-04-26 — [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
 - 2026-04-26 — [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
 - 2026-04-26 — [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
 - 2026-04-26 — [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
```

`**Last updated:**` is already 2026-04-26 — no change needed.
`## Known drift` stays at `_none_` — no change needed.
