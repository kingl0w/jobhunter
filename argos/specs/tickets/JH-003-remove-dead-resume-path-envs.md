# JH-003: Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** S

## Intent

Delete the dead `IT_RESUME_PATH` and `DEV_RESUME_PATH` environment variables from `.env.example`. They are leftovers from the pre-multi-resume schema and are read by nothing.

## Context

`ARCHITECTURE.md` "Known drift" entry: `.env.example` lists `IT_RESUME_PATH` and `DEV_RESUME_PATH` environment variables. `backend/config.py` defines no corresponding Settings fields, so these vars are read by nothing. They are leftovers from a pre-multi-resume schema (see `backend/migrate.py` docstring, which describes the cutover from "old IT/Dev schema → generic multi-resume").

Resolution: delete the dead variables from `.env.example`. Single-resume-per-role-type is no longer the schema; resumes are now uploaded via the `/resumes` endpoint and tracked in the `resumes` table.

## Scope

- Remove the `IT_RESUME_PATH` and `DEV_RESUME_PATH` lines from `.env.example`.
- Remove any inline comments above those lines that exclusively describe them.

## Non-goals

- Do **not** modify `backend/config.py` — already correctly omits these fields.
- Do **not** modify `backend/migrate.py` — its docstring is historical context and worth keeping.
- Do **not** modify `backend/models.py` or any source code — schema is already multi-resume.
- Do **not** update `ARCHITECTURE.md`'s Known drift section — deferred to the Phase 1 closeout ticket.

## Acceptance criteria (draft — planner will refine)

- `grep -n -E "IT_RESUME_PATH|DEV_RESUME_PATH" .env.example` returns no results.
- `grep -rn -E "IT_RESUME_PATH|DEV_RESUME_PATH" backend/ frontend/` returns no results (confirms truly dead — nothing references them).
- `.env.example` still contains `GEMINI_API_KEY` (don't accidentally nuke unrelated lines).
- `git diff --stat` shows ONLY `.env.example` modified (plus ticket and STATE).
- `backend/` and `frontend/` unchanged.

## Plan

### Files touched

- `/home/taddymason/projects/programs/jobhunter/.env.example` — **edit** (only file modified)

### Changes per file

**`.env.example`** (edit)

Current contents (verified, 7 lines, ends with single `\n`):

```
# Get one free at https://aistudio.google.com/apikey
GEMINI_API_KEY=
IT_RESUME_PATH=resumes/base_it.docx
DEV_RESUME_PATH=resumes/base_dev.docx
SYNC_INTERVAL_HOURS=6
MAX_RESULTS_PER_SOURCE=25
HOURS_OLD=72
```

Delete exactly these two lines (lines 3 and 4):

- `IT_RESUME_PATH=resumes/base_it.docx`
- `DEV_RESUME_PATH=resumes/base_dev.docx`

No comments need to be removed: the only comment in the file (line 1, `# Get one free at https://aistudio.google.com/apikey`) describes `GEMINI_API_KEY` on line 2, not the dead vars. There are no blank-line separators or inline comments above the dead vars to clean up.

Preserve the trailing newline at end-of-file (currently a single `\n` after `HOURS_OLD=72`).

Resulting file contents (5 lines + trailing newline):

```
# Get one free at https://aistudio.google.com/apikey
GEMINI_API_KEY=
SYNC_INTERVAL_HOURS=6
MAX_RESULTS_PER_SOURCE=25
HOURS_OLD=72
```

### Acceptance criteria (refined, runnable)

All commands run from repo root `/home/taddymason/projects/programs/jobhunter`. Each lists pass condition.

1. **Dead vars gone from `.env.example`:**
   `grep -n -E "IT_RESUME_PATH|DEV_RESUME_PATH" .env.example`
   Pass: exit code 1, no stdout.

2. **Dead vars not referenced anywhere in source:**
   `grep -rn -E "IT_RESUME_PATH|DEV_RESUME_PATH" backend/ frontend/`
   Pass: exit code 1, no stdout.

3. **`GEMINI_API_KEY` still present in `.env.example`:**
   `grep -n "^GEMINI_API_KEY=" .env.example`
   Pass: exit code 0, stdout `2:GEMINI_API_KEY=`.

4. **Other unrelated lines preserved:**
   `grep -cE "^(SYNC_INTERVAL_HOURS|MAX_RESULTS_PER_SOURCE|HOURS_OLD)=" .env.example`
   Pass: exit code 0, stdout `3`.

5. **Diff scope is correct — only `.env.example` (plus ticket/STATE) touched:**
   `git diff --stat -- . ':!argos/specs/tickets/JH-003-remove-dead-resume-path-envs.md' ':!argos/specs/STATE.md'`
   Pass: shows only `.env.example | 2 +-` (or equivalent — exactly one file, two deletions).

6. **`backend/` and `frontend/` unmodified:**
   `git diff --stat -- backend/ frontend/`
   Pass: empty stdout.

7. **File ends with a single trailing newline (POSIX-clean):**
   `tail -c 1 .env.example | od -c | head -1`
   Pass: stdout shows `0000000  \n` (final byte is `\n`).

8. **File is exactly 5 content lines:**
   `wc -l .env.example`
   Pass: stdout shows `5 .env.example`.

### Test strategy

No automated test harness exists (per `ARCHITECTURE.md` "Code style"). Verification is the eight `grep` / `git diff` / `wc` / `tail` commands above, run from repo root. Verifier should quote real stdout for each, per the "no hallucinated test results" rule.

No new test files. No `pytest` / `npm test` invocations apply — config-only edit.

### Open questions

None. The edit is deterministic: two whole lines to delete, no surrounding comments to disambiguate, no source references anywhere in `backend/` or `frontend/`.

### Out-of-scope reminders (from ticket Non-goals)

- Do **not** modify `backend/config.py` (already omits these fields — verified during planning).
- Do **not** modify `backend/migrate.py` (its docstring is historical context).
- Do **not** modify `backend/models.py` or any source code.
- Do **not** update `ARCHITECTURE.md`'s Known drift section (deferred to Phase 1 closeout ticket).
- Do **not** add new env vars, reorder remaining lines, or reformat the file.

## Verification

Verified at 2026-04-26 from repo root `/home/taddymason/projects/programs/jobhunter`. All 8 acceptance commands run; real stdout quoted below.

### Acceptance criteria — real output

**1. Dead vars gone from `.env.example`** — PASS

```
$ grep -n -E "IT_RESUME_PATH|DEV_RESUME_PATH" .env.example
(no stdout)
exit code: 1
```

**2. Dead vars not referenced anywhere in `backend/` or `frontend/`** — PASS

```
$ grep -rn -E "IT_RESUME_PATH|DEV_RESUME_PATH" backend/ frontend/
(no stdout)
exit code: 1
```

**3. `GEMINI_API_KEY` still present in `.env.example`** — PASS

```
$ grep -n "^GEMINI_API_KEY=" .env.example
2:GEMINI_API_KEY=
exit code: 0
```

**4. Other unrelated lines preserved (3 expected: SYNC_INTERVAL_HOURS, MAX_RESULTS_PER_SOURCE, HOURS_OLD)** — PASS

```
$ grep -cE "^(SYNC_INTERVAL_HOURS|MAX_RESULTS_PER_SOURCE|HOURS_OLD)=" .env.example
3
exit code: 0
```

**5. Diff scope is correct — only `.env.example` modified (excluding ticket + STATE)** — PASS

```
$ git diff --stat -- . ':!argos/specs/tickets/JH-003-remove-dead-resume-path-envs.md' ':!argos/specs/STATE.md'
 .env.example | 2 --
 1 file changed, 2 deletions(-)
exit code: 0
```

Exactly one file modified (`.env.example`), exactly two line deletions. Plan called for `2 +-` or equivalent; the `2 --` form (pure deletions, no insertions) is the stricter, expected outcome since both removed lines were whole-line deletes.

**6. `backend/` and `frontend/` unmodified** — PASS

```
$ git diff --stat -- backend/ frontend/
(no stdout)
exit code: 0
```

**7. File ends with a single trailing newline (POSIX-clean)** — PASS

```
$ tail -c 1 .env.example | od -c | head -1
0000000  \n
exit code: 0
```

**8. File is exactly 5 content lines** — PASS

```
$ wc -l .env.example
5 .env.example
exit code: 0
```

### Content diff (for the record)

```
$ git diff -- .env.example
diff --git a/.env.example b/.env.example
index cc2215d..9835119 100644
--- a/.env.example
+++ b/.env.example
@@ -1,7 +1,5 @@
 # Get one free at https://aistudio.google.com/apikey
 GEMINI_API_KEY=
-IT_RESUME_PATH=resumes/base_it.docx
-DEV_RESUME_PATH=resumes/base_dev.docx
 SYNC_INTERVAL_HOURS=6
 MAX_RESULTS_PER_SOURCE=25
 HOURS_OLD=72
```

Diff is exactly the two whole-line deletions called out in the plan. No reordering, no comment changes, no whitespace damage. Trailing newline preserved.

### Regression scan

- **Wider source grep (Python / TS / TSX / JS / JSON / YAML / TOML, excluding `argos/specs/` and `.git/`):**
  ```
  $ grep -rn -E "IT_RESUME_PATH|DEV_RESUME_PATH" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.toml" . | grep -v argos/specs/ | grep -v .git/
  (no stdout)
  exit code: 1
  ```
  Confirms no live code references — they really are dead. The only surviving textual references are this ticket and the historical context in `backend/migrate.py` (kept intentionally per Non-goals) and `argos/specs/ARCHITECTURE.md` "Known drift" entry (kept intentionally per Non-goals — deferred to Phase 1 closeout).

- **`git status --short`:**
  ```
   M .env.example
   M argos/specs/STATE.md
  ?? argos/specs/tickets/JH-003-remove-dead-resume-path-envs.md
  ```
  `STATE.md` shows as modified because the planner/coder added JH-003 to the queue earlier in this cycle. Ticket file is untracked because it was newly created this cycle. Both are expected and excluded from the scope-check command per the plan.

- **No automated test harness exists** (per `ARCHITECTURE.md` "Code style": "Tests: no harness exists today"). No `pytest` / `npm test` to run for a config-only edit. The eight grep / git-diff / wc / tail commands above are the verification surface, per the plan's Test strategy.

- **No callers to grep for** — the variables were unreferenced (criterion 2), so there is no "callers of modified functions" surface to regress.

- **No dependency, schema, or runtime-path changes.** This is a documentation/example file edit; backend startup, scheduler, scoring, and tailoring paths are byte-identical.

### ARCHITECTURE.md drift note (informational — no edit)

`argos/specs/ARCHITECTURE.md` line 127 still contains the "Known drift" bullet:

> `.env.example` lists `IT_RESUME_PATH` and `DEV_RESUME_PATH`. `backend/config.py` defines no corresponding settings — leftovers from the pre-multi-resume schema (see `backend/migrate.py` docstring).

That entry is now stale (the vars are gone). Per ticket Non-goals: do **not** edit ARCHITECTURE.md here — the user has deferred drift-list reconciliation to a Phase 1 closeout follow-up ticket. Flagging for the parent / next planner: this bullet should be removed when the closeout ticket runs. (Note: the same ARCHITECTURE.md drift list also still contains the JH-001 README entry and the JH-002 docker-compose `DATABASE_URL` entry, which are similarly stale post-merge — closeout should sweep all three at once.)

### STATE.md diff proposal (parent applies; verifier does not write)

Apply this diff to `/home/taddymason/projects/programs/jobhunter/argos/specs/STATE.md`:

```diff
@@ ## Queue
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.

-- [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
+- _none_

@@ ## Done this cycle
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.

+- 2026-04-26 — [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
 - 2026-04-26 — [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
 - 2026-04-24 — [JH-001](tickets/JH-001-readme-gemini-api-key.md) — Fix README API key drift: ANTHROPIC_API_KEY → GEMINI_API_KEY (P3)
```

- `**Last updated:**` is already `2026-04-26` — no change.
- `## Known drift` stays at `_none_` — STATE never tracked this drift; ARCHITECTURE.md does, and that entry is intentionally untouched per Non-goals.
- New JH-003 entry placed **above** the existing JH-002 line, matching the JH-002 precedent of newest-on-top within "Done this cycle".

### Status

**READY**
