# JH-001 — Fix README API key drift: ANTHROPIC_API_KEY → GEMINI_API_KEY

**Status:** Done
**Created:** 2026-04-24
**Priority:** P3

## Intent

Correct the README so that a new user following the setup instructions can actually run the app. The README currently tells users to set `ANTHROPIC_API_KEY`, but the code reads `GEMINI_API_KEY`.

## Context

`README.md` line 14 instructs the user to set `ANTHROPIC_API_KEY=sk-ant-...` in `.env`. This is wrong. The actual code reads `GEMINI_API_KEY`:

- `backend/config.py` defines `Settings.gemini_api_key`
- `backend/tailor.py` imports `google.genai` and calls Gemini 2.5 Flash
- `.env.example` correctly uses `GEMINI_API_KEY`

Anyone following the README cannot run the app.

Estimated effort: S (single file, <30 lines changed).

## Non-goals

- Do NOT modify `backend/config.py`, `backend/tailor.py`, `.env.example`, `docker-compose.yml`, or any source code — code is already correct.
- Do NOT update the Known drift section of `ARCHITECTURE.md` yet; verifier handles that as part of STATE reconciliation.
- No refactors, no unrelated README cleanup.

## Scope

- Update `README.md` line 14 (the `.env` example block) to use `GEMINI_API_KEY`.
- Update any surrounding prose in `README.md` that refers to Anthropic/Claude where it should refer to Google/Gemini (e.g. "AI API key" descriptions, "Claude API" references, setup instructions).

## Acceptance criteria (draft — planner will refine)

- `grep -n -i anthropic README.md` returns no results (or only historical context clearly marked as such).
- `grep -n GEMINI_API_KEY README.md` returns the updated env example line.
- README renders correctly on GitHub (no broken markdown).
- No changes to any file under `backend/` or `frontend/`.

## Plan

### Files to change

**`README.md`** (edit) — single-line replacement inside the env example code block.

- **Line 14**, before:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ```
  After:
  ```
  GEMINI_API_KEY=...
  ```
- No other edits. Line 11's prose ("Edit `.env` and add your AI API key:") is provider-agnostic and stays as written. The rest of the README (Setup, Resumes, Run, Usage, Seed data) contains zero `anthropic`/`claude`/`sk-ant` references (verified via `grep -n -i -E "anthropic|claude|sk-ant" README.md` — only line 14 matches) and must not be touched.

### Files NOT to change

Mirrors the ticket's non-goals. The coder and watchdog must reject any diff to these:

- `backend/**` — code is already correct; reads `GEMINI_API_KEY`.
- `frontend/**` — unrelated.
- `.env.example` — already uses `GEMINI_API_KEY` on line 2 and carries the aistudio URL hint on line 1.
- `docker-compose.yml` — out of scope (separate drift item tracked in ARCHITECTURE.md).
- `argos/specs/ARCHITECTURE.md` — the Known drift entry stays until verifier reconciles.
- `argos/specs/STATE.md` — verifier's job.

### Dependencies

**None.** This is a docs-only change. Any diff to `backend/requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`, `pyproject.toml`, or any other dependency manifest is unauthorized and the watchdog must flag it.

### Refined acceptance criteria

The verifier runs these exact commands from the repo root and checks the quoted results:

1. `grep -n -i -E "anthropic|claude|sk-ant" README.md` — must exit non-zero (no matches). No "historical context" carve-out; the fix is a straight replacement.
2. `grep -n "GEMINI_API_KEY" README.md` — must return exactly one line, and that line must be inside the env-example fenced code block (currently line 14 region).
3. `git diff --name-only main...HEAD` — must list exactly `README.md` and the ticket file (`argos/specs/tickets/JH-001-readme-gemini-api-key.md`). Nothing else.
4. `git diff --stat README.md` — expect roughly 1 insertion, 1 deletion (single-line replacement). A change larger than ~5 lines means the coder drifted into unscoped cleanup.
5. Markdown sanity: the fenced code block starting at line 13 (```` ``` ````) must still close properly; `awk '/^```/{n++} END{print n}' README.md` must print an even number.

### Risk / edge cases

- **Placeholder value format.** `.env.example` uses an empty value (`GEMINI_API_KEY=`). The README currently shows a placeholder shape (`sk-ant-...`). Use `GEMINI_API_KEY=...` (generic ellipsis) to match the spirit of the original without claiming a Gemini-specific key prefix convention. Do NOT invent a fake prefix like `AIza...`.
- **Trailing whitespace / final newline.** Preserve the file's existing line endings and trailing newline. A single-line edit should not re-flow the file.
- **Code fence integrity.** The edit is inside a triple-backtick block (opens line 13, closes line 15). Do not accidentally close or reopen the fence.
- **No drive-by prose edits.** The line "Edit `.env` and add your AI API key:" reads correctly for Gemini too. Resist the urge to rewrite it to mention Google/Gemini explicitly — that's scope creep and the ticket's "No refactors, no unrelated README cleanup" clause forbids it.
- **No link additions.** Do not add a link to `https://aistudio.google.com/apikey` in the README. The hint already lives in `.env.example` line 1, which the user sees after `cp .env.example .env`.

### Open questions

_None._ The ticket is unambiguous, the scope is one line, and the replacement value is mechanically determined by `.env.example`.

## Verification

Ran all five refined acceptance criteria from the repo root on 2026-04-24. Real stdout below.

**1. `grep -n -i -E "anthropic|claude|sk-ant" README.md`** — expect non-zero exit, no matches.

```
(no output)
EXIT=1
```

Pass: no forbidden terms remain.

**2. `grep -n "GEMINI_API_KEY" README.md`** — expect exactly one line inside the env-example fence.

```
14:GEMINI_API_KEY=...
EXIT=0
```

Pass: single match on line 14, between the opening fence on line 13 and closing fence on line 15 (verified by reading the file).

**3. `git diff --name-only` + `git status --short`** — expect `README.md` modified, `argos/specs/STATE.md` modified (pre-existing Queue entry from `/new-ticket`), and untracked ticket file.

```
README.md
argos/specs/STATE.md
---
 M README.md
 M argos/specs/STATE.md
?? argos/specs/tickets/
```

Pass: scope matches (README.md is the only coder-authored modification; STATE.md and the ticket file are planner/new-ticket artifacts).

**4. `git diff --stat README.md`** — expect ~1 insertion, 1 deletion.

```
 README.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Pass: exactly 1 insertion, 1 deletion. Content diff:

```
-ANTHROPIC_API_KEY=sk-ant-...
+GEMINI_API_KEY=...
```

**5. `awk '/^```/{n++} END{print n}' README.md`** — expect even number.

```
12
```

Pass: 12 is even; all fenced code blocks close properly.

### Regression scan

Docs-only change to `README.md`. No source files under `backend/` or `frontend/` touched. No dependency manifests modified. No callers to grep — there are no functions or symbols affected. Repo has no unit test suite, so no test run applies.

Status: Done
