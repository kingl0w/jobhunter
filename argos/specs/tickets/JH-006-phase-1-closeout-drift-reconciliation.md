# JH-006: Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** S

## Intent

Reconcile `argos/specs/ARCHITECTURE.md` and `argos/specs/PRD.md` so their drift sections reflect current reality. JH-001 through JH-005 each closed a "Known drift" finding; each ticket's Non-goals forbade editing ARCHITECTURE.md mid-fix on the agreement that drift reconciliation would happen in a single closeout pass once Phase 1 was done. This ticket is that closeout.

## Context

JH-001 through JH-005 each closed a "Known drift" finding originally captured in ARCHITECTURE.md when the spec was first drafted. Each ticket's Non-goals forbade editing ARCHITECTURE.md mid-fix, on the agreement that drift reconciliation would happen in a single closeout pass once Phase 1 was done.

This ticket is that closeout pass. Its only purpose is to make ARCHITECTURE.md and PRD.md reflect current reality — the drift findings are no longer drift, they're closed.

**Resolved drift bullets to remove from `ARCHITECTURE.md` "## Known drift":**

- README ANTHROPIC_API_KEY vs code GEMINI_API_KEY (closed by JH-001)
- docker-compose `DATABASE_URL` dead vs `config.py` hardcoded path (closed by JH-002)
- README scoring claim implies LLM (closed by JH-005)
- `.env.example` `IT_RESUME_PATH`/`DEV_RESUME_PATH` dead vars (closed by JH-003)
- Frontend source filter exposes sites the scraper doesn't hit (closed by JH-004)

**Note:** the sixth Known drift bullet ("docker-compose does not build the frontend") is NOT resolved — that's deferred to Phase 3 (production deploy). Do NOT remove it.

**Also reconcile `PRD.md`:**

- PRD's "Out-of-band context" section references README `ANTHROPIC_API_KEY` drift and docker-compose `DATABASE_URL` drift as "known doc drift" pointing to ARCHITECTURE. Both are now closed. Remove those specific references.
- PRD's Open questions, Goals, etc. should NOT change — only the historical drift mention.

## Scope

- Edit `argos/specs/ARCHITECTURE.md`: remove the five resolved bullets from the "## Known drift" section. If only the unresolved frontend Dockerfile bullet remains, that's correct end state. Do NOT delete the section header itself.
- Edit `argos/specs/PRD.md`: remove or rewrite the drift pointer in "Out-of-band context" so it no longer references closed drift items. The rest of "Out-of-band context" (deploy target note, prior-schema IT/DEV_RESUME context) stays.

## Non-goals

- Do **not** modify any source code, `README.md`, `.env.example`, `docker-compose.yml`, or any frontend file.
- Do **not** add new drift entries.
- Do **not** update `STATE.md`'s Known drift section — it's already `_none_` and stays that way.

## Acceptance criteria (draft — planner will refine)

- `argos/specs/ARCHITECTURE.md` "## Known drift" section contains AT MOST the one unresolved bullet (frontend Dockerfile / one-command production start). None of the five resolved drift items appear.
- `grep -n -i -E "ANTHROPIC_API_KEY|DATABASE_URL|IT_RESUME_PATH|DEV_RESUME_PATH|zip_recruiter" argos/specs/ARCHITECTURE.md argos/specs/PRD.md` returns no results, OR only results in clearly historical/contextual prose (e.g. "see `backend/migrate.py` docstring" pointing to the schema cutover). No claims that any of these are *current* drift.
- `argos/specs/ARCHITECTURE.md` still has every other section intact (Components, Contracts, Invariants, Code style, etc.) — verify by section header count.
- `argos/specs/PRD.md` still has every other section intact (Problem, Goals, Non-goals, Success metrics, etc.).
- `git diff --stat` shows ONLY `argos/specs/ARCHITECTURE.md`, `argos/specs/PRD.md`, the ticket file, and `STATE.md` modified. NO source code, NO docs outside `argos/specs/`.
- `bash argos/scripts/argos-chaos-probe.sh state` returns `state: PASS`.

## Plan

### Files touched

- `argos/specs/ARCHITECTURE.md` (edit) — remove 5 resolved drift bullets from "## Known drift", keep the unresolved Dockerfile bullet.
- `argos/specs/PRD.md` (edit) — remove the closed-drift pointer from "## Out-of-band context" (line 65). Keep the deploy-target bullet (line 63) and the prior-schema IT/DEV_RESUME historical bullet (line 64) untouched.
- `argos/specs/tickets/JH-006-phase-1-closeout-drift-reconciliation.md` (edit) — this Plan section (current append). Verifier will append `## Verification`. STATE.md is updated by the verifier on pass; coder must not touch it.

### Pre-edit structural map

`argos/specs/ARCHITECTURE.md` — 8 top-level (`^## `) section headers, in order:
1. `## System shape` (L8)
2. `## Components` (L24)
3. `## Contracts` (L56)
4. `## Invariants` (L79)
5. `## Technology choices` (L92)
6. `## Code style` (L102)
7. `## What this architecture deliberately does not support` (L111)
8. `## Known drift` (L120)

`argos/specs/PRD.md` — 9 top-level (`^## `) section headers, in order:
1. `## One-line pitch` (L7)
2. `## Problem` (L11)
3. `## Target user` (L15)
4. `## Goals` (L19)
5. `## Non-goals` (L30)
6. `## Success metrics` (L36)
7. `## Constraints` (L46)
8. `## Open questions` (L54)
9. `## Out-of-band context` (L61)

Post-edit invariant: header counts unchanged (8 and 9). Only the `## Known drift` *contents* shrink in ARCHITECTURE.md; only one bullet under `## Out-of-band context` is removed in PRD.md.

### Changes per file

#### `argos/specs/ARCHITECTURE.md` — "## Known drift" section (L120–L129)

Keep the section header + intro lines verbatim:

- L120: `## Known drift`
- L121: blank
- L122: `Code-vs-docs and code-vs-code mismatches observed in this pass. Each should become an ADR or a cleanup ticket.`
- L123: blank

Delete bullets L124–L128 (closed by JH-001..JH-005):

- L124 (closed by JH-001 — README ANTHROPIC_API_KEY drift):
  ```
  - **README vs env.** `README.md` instructs `ANTHROPIC_API_KEY=sk-ant-...`. The actual code (`backend/config.py`, `backend/tailor.py`) reads `GEMINI_API_KEY` via `google-genai`, and `.env.example` agrees. The README is stale.
  ```
- L125 (closed by JH-002 — docker-compose DATABASE_URL):
  ```
  - **docker-compose vs config.** `docker-compose.yml` sets `DATABASE_URL=sqlite:///./data/jobhunter.db`. `backend/config.py` hardcodes `db_path="data/jobs.db"` and does not read `DATABASE_URL`. The env var is dead, and the filenames don't even match.
  ```
- L126 (closed by JH-005 — README scoring claim):
  ```
  - **README scoring claim.** README implies scoring is part of the "AI" flow (single `ANTHROPIC_API_KEY` suggests LLM everywhere). Code reality: `backend/scorer.py` is regex + `SYNONYM_MAP`; only `tailor.py` calls the LLM.
  ```
- L127 (closed by JH-003 — dead resume-path env vars):
  ```
  - **Dead env vars.** `.env.example` lists `IT_RESUME_PATH` and `DEV_RESUME_PATH`. `backend/config.py` defines no corresponding settings — leftovers from the pre-multi-resume schema (see `backend/migrate.py` docstring).
  ```
- L128 (closed by JH-004 — frontend source filter):
  ```
  - **Frontend source filter vs scraper.** `frontend/app/page.tsx` exposes a source filter with `zip_recruiter` and `google` options; `backend/fetcher.py` scrapes only `FULL_SITES = ["indeed", "linkedin"]` in production. The UI offers filters for sources that produce no data.
  ```

Keep L129 verbatim (UNRESOLVED — deferred to Phase 3 production deploy):

```
- **docker-compose does not build the frontend.** Only `./backend` is a service. `frontend/` has no Dockerfile. README's "Run" section treats this as intentional (two separate commands), but it means there is no one-command production start.
```

End-state of section (lines 120–125 post-edit, exact):

```
## Known drift

Code-vs-docs and code-vs-code mismatches observed in this pass. Each should become an ADR or a cleanup ticket.

- **docker-compose does not build the frontend.** Only `./backend` is a service. `frontend/` has no Dockerfile. README's "Run" section treats this as intentional (two separate commands), but it means there is no one-command production start.
```

Trailing newline at EOF preserved. No other section in ARCHITECTURE.md changes.

#### `argos/specs/PRD.md` — "## Out-of-band context" section (L61–L65)

Keep verbatim:

- L61: `## Out-of-band context`
- L62: blank
- L63: `- Intended deploy target is a home server ("hserver-1" — see Success metrics). The repo does not yet contain deployment artifacts for it; current docker-compose assumes the operator runs it interactively on localhost.`
- L64 (verbatim, kept as-is): `- The codebase shows evidence of a prior "IT / Dev resume" schema (see backend/migrate.py docstring, and dead IT_RESUME_PATH / DEV_RESUME_PATH entries in .env.example). The current schema is generic multi-resume; any references to two hardcoded resume slots are historical.` (Note: the actual file uses backticks around `backend/migrate.py`, `IT_RESUME_PATH`, `DEV_RESUME_PATH`, `.env.example` — they are stripped here only to keep this Plan render clean; the file content itself is unchanged.)

Delete L65 in full (this is the closed-drift pointer; both findings it cites are now resolved):

```
- Known doc drift (flagged in more detail in `ARCHITECTURE.md` → Known drift): README names `ANTHROPIC_API_KEY` but the code reads `GEMINI_API_KEY`; `docker-compose.yml` sets `DATABASE_URL` but `config.py` ignores it.
```

No replacement bullet — just remove the line (and any trailing blank that becomes redundant; preserve a single trailing newline at EOF).

No other section in PRD.md changes. `## Open questions` line 56 still mentions "the README's 'scoring' claim implies LLM" — that is an unresolved product question (LLM-vs-keyword scoring tradeoff), not drift, and the ticket explicitly says Open questions do NOT change. Leave it.

### Acceptance criteria (refined, runnable)

Run from repo root `/home/taddymason/projects/programs/jobhunter`:

1. **No closed-drift drift-claim strings remain in either spec.**
   ```
   grep -n -i -E "ANTHROPIC_API_KEY|DATABASE_URL|zip_recruiter" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
   ```
   Pass condition: no matches. (PRD L64's `IT_RESUME_PATH`/`DEV_RESUME_PATH` mention is allowed per ticket — see check #2.)

2. **Resume-path env strings only survive in the L64 historical-context bullet.**
   ```
   grep -n -E "IT_RESUME_PATH|DEV_RESUME_PATH" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
   ```
   Pass condition: zero matches in `ARCHITECTURE.md`; exactly one matching line in `PRD.md` (the historical "prior IT / Dev resume schema" bullet, which mentions `backend/migrate.py` docstring). No other matches.

3. **`google` and other tokens still appear only in legitimate non-drift prose.**
   ```
   grep -n -E "\bgoogle\b" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
   ```
   Pass condition: only matches that refer to `google-genai` (the Python package) or the Gemini system-shape diagram — i.e. `ARCHITECTURE.md` L19 (`google-genai ──▶ gemini-2.5-flash`), L97 (`via google-genai`), L118 (`google.genai`); `PRD.md` L26, L48 (`google-genai`). No bullet under `## Known drift` may contain `google`.

4. **"## Known drift" section: header survives, only one bullet remains.**
   ```
   awk '/^## Known drift/,/^## /{print}' argos/specs/ARCHITECTURE.md | grep -c '^- '
   ```
   Pass condition: output is `1`. (Plus the `## Known drift` header line is still present.)
   ```
   grep -n "^## Known drift" argos/specs/ARCHITECTURE.md
   ```
   Pass condition: exactly one match.

5. **The surviving drift bullet is the Dockerfile / production-deploy one.**
   ```
   grep -n "docker-compose does not build the frontend" argos/specs/ARCHITECTURE.md
   ```
   Pass condition: exactly one match, inside the `## Known drift` section.

6. **All other top-level sections in ARCHITECTURE.md are intact.**
   ```
   grep -c "^## " argos/specs/ARCHITECTURE.md
   ```
   Pass condition: output is `8` (unchanged from pre-edit).
   ```
   grep -n "^## " argos/specs/ARCHITECTURE.md
   ```
   Pass condition: emits, in order, the 8 headers listed in "Pre-edit structural map" above.

7. **All top-level sections in PRD.md are intact.**
   ```
   grep -c "^## " argos/specs/PRD.md
   ```
   Pass condition: output is `9`.
   ```
   grep -n "^## " argos/specs/PRD.md
   ```
   Pass condition: emits, in order, the 9 headers listed in "Pre-edit structural map" above.

8. **PRD's Out-of-band context lost the drift pointer but kept the other two bullets.**
   ```
   awk '/^## Out-of-band context/,0' argos/specs/PRD.md | grep -c '^- '
   ```
   Pass condition: output is `2`.
   ```
   grep -n "Known doc drift" argos/specs/PRD.md
   ```
   Pass condition: no match.
   ```
   grep -n "Intended deploy target is a home server" argos/specs/PRD.md
   ```
   Pass condition: exactly one match.
   ```
   grep -n "prior \"IT / Dev resume\" schema" argos/specs/PRD.md
   ```
   Pass condition: exactly one match.

9. **Diff scope is limited to the spec docs (and ticket file + STATE.md once verifier writes it).**
   ```
   git diff --name-only
   ```
   Pass condition: the only paths listed are a subset of:
   - `argos/specs/ARCHITECTURE.md`
   - `argos/specs/PRD.md`
   - `argos/specs/tickets/JH-006-phase-1-closeout-drift-reconciliation.md`
   - `argos/specs/STATE.md` (only after verifier runs)

   No source code (`backend/`, `frontend/`), no `README.md`, no `docker-compose.yml`, no `.env.example`, no other docs.

   ```
   git diff --stat
   ```
   Pass condition: only the four files above appear; ARCHITECTURE.md and PRD.md show net deletions (5 bullets gone in ARCHITECTURE; 1 bullet gone in PRD) with no insertions other than what this Plan/Verification append produces in the ticket.

10. **Markdown well-formedness in edited files.**
    ```
    python3 -c 'import sys; t=open("argos/specs/ARCHITECTURE.md").read(); assert t.count("`")%2==0, "unbalanced backticks"; assert t.count("[")==t.count("]"), "unbalanced brackets"; assert t.count("(")==t.count(")"), "unbalanced parens"; print("ARCHITECTURE.md: PASS")'
    python3 -c 'import sys; t=open("argos/specs/PRD.md").read(); assert t.count("`")%2==0, "unbalanced backticks"; assert t.count("[")==t.count("]"), "unbalanced brackets"; assert t.count("(")==t.count(")"), "unbalanced parens"; print("PRD.md: PASS")'
    ```
    Pass condition: both lines print `PASS`. (Pre-edit baseline already balances — verifier may sanity-check pre-edit on a clean checkout if a counter-example surfaces.)

11. **Chaos probe — state probe passes.**
    ```
    bash argos/scripts/argos-chaos-probe.sh state
    ```
    Pass condition: stdout is exactly `state: PASS` and exit code 0. (Probe verified to behave this way pre-edit; the edit does not affect ticket-id/state cross-references because no ticket files are renamed and no IDs are added or removed in STATE.md.)

### Test strategy

This is a docs-only edit; there is no compiled or executable behavior to unit-test. The acceptance commands above (sections 1–11) are the test plan and run directly from the shell. No new test files are added. No test runner is invoked beyond `grep`, `awk`, `python3` for markdown balance, and the existing `argos/scripts/argos-chaos-probe.sh state`.

Recommended verifier execution order:

1. Run #11 (`argos-chaos-probe.sh state`) first as a smoke test.
2. Run #6 + #7 (header counts) — fastest "did we accidentally nuke a section" check.
3. Run #1, #2, #3 (string-presence checks) — confirm the actual deletions.
4. Run #4, #5, #8 (section-shape checks).
5. Run #9 (`git diff --stat`) — confirms no scope creep into source code.
6. Run #10 (markdown balance).

Quote real stdout for each (per Argos rule "no hallucinated test results").

### Open questions

- **PRD.md L64 is now mildly stale but the ticket says keep it.** The bullet says `IT_RESUME_PATH` / `DEV_RESUME_PATH` are "dead ... entries in `.env.example`" — JH-003 actually removed them from `.env.example`, so they are no longer entries there at all. The ticket's Scope and Non-goals explicitly say this prior-schema bullet stays unchanged, so the plan keeps it verbatim. Flagging in case the operator wants a follow-up ticket to refresh the prose to past tense (e.g. "and previously dead `IT_RESUME_PATH` / `DEV_RESUME_PATH` entries — since removed in JH-003"). Not in scope for JH-006.

- **PRD.md "## Open questions" L56** still says the README's scoring claim "implies LLM but the code does not." JH-005 fixed the README, so the parenthetical premise is now stale, but the underlying open question (should the scorer move to LLM-based scoring?) is still open. Ticket explicitly says Open questions do NOT change. Plan keeps L56 verbatim. Flagging as a candidate for a separate, narrowly-scoped doc-edit ticket if the operator wants to refresh the parenthetical.

Both items are non-blocking. Plan proceeds without resolution.

### Out-of-scope reminders (from Non-goals)

- Do **not** modify `README.md`, `.env.example`, `docker-compose.yml`, `backend/`, `frontend/`, or any other source/doc file.
- Do **not** add new drift entries to ARCHITECTURE.md.
- Do **not** edit `STATE.md` "Known drift" section (already `_none_`); coder must not touch STATE.md at all — verifier writes it on pass.
- Do **not** delete the `## Known drift` header itself even though only one bullet survives.
- Do **not** rewrite PRD's deploy-target bullet (L63) or prior-schema IT/DEV_RESUME bullet (L64); only the closed-drift pointer bullet (L65) is removed.

## Verification

Run from `/home/taddymason/projects/programs/jobhunter`. All commands executed; real stdout quoted.

### Watchdog-ruled interpretation (acknowledged)

Two known string survivals are explicitly permitted by the ticket's Acceptance criterion ("returns no results, OR only results in clearly historical/contextual prose. No claims that any of these are *current* drift") and by the ticket Scope:

- `argos/specs/ARCHITECTURE.md:30` — `## Components` paragraph for `backend/fetcher.py` says "`ALL_SITES` also includes `zip_recruiter` and `google` but they're excluded via `FLAKY_SITES` guard." This is factual component documentation, not a drift claim. PERMITTED.
- `argos/specs/PRD.md:64` — `## Out-of-band context` historical bullet keeps `IT_RESUME_PATH` / `DEV_RESUME_PATH` mentions in clearly historical prose ("evidence of a prior … schema", "any references … are historical"). Ticket Scope explicitly preserves this bullet. PERMITTED.

These are not failures.

### Per-criterion results

**#1 — No closed-drift drift-claim strings remain.**

```
$ grep -n -i -E "ANTHROPIC_API_KEY|DATABASE_URL|zip_recruiter" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
argos/specs/ARCHITECTURE.md:30:Wraps `python-jobspy`. `FULL_SITES = ["indeed", "linkedin"]` are scraped in production; `ALL_SITES` also includes `zip_recruiter` and `google` but they're excluded via `FLAKY_SITES` guard. Concurrent scrapes (`ThreadPoolExecutor`) per (site, term) pair. Every active `SearchTerm` is queried. Upserts via `upsert_job()` → deterministic `Job.make_id`. Jobs not re-seen for `STALE_DAYS=14` are marked `is_active=False`.
```

Sole match is the `## Components` factual code description — explicitly permitted by ticket text and watchdog ruling. No `ANTHROPIC_API_KEY` or `DATABASE_URL` anywhere. PASS.

**#2 — Resume-path env strings only in PRD L64 historical bullet.**

```
$ grep -n -E "IT_RESUME_PATH|DEV_RESUME_PATH" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
argos/specs/PRD.md:64:- The codebase shows evidence of a prior "IT / Dev resume" schema (see `backend/migrate.py` docstring, and dead `IT_RESUME_PATH` / `DEV_RESUME_PATH` entries in `.env.example`). The current schema is generic multi-resume; any references to two hardcoded resume slots are historical.
```

Zero matches in ARCHITECTURE.md, exactly one in PRD.md (the historical bullet). PASS.

**#3 — `google` only in legitimate non-drift prose.**

```
$ grep -n -E "\bgoogle\b" argos/specs/ARCHITECTURE.md argos/specs/PRD.md
argos/specs/PRD.md:26:4. Generate per-job tailored resumes on demand using Gemini (`gemini-2.5-flash` via `google-genai`). Ground the output against the base `.docx` so keywords not present in the source resume cannot be fabricated (`ground_check_keywords` in `backend/tailor.py`).
argos/specs/PRD.md:48:- **Technical:** Python 3.12 backend (FastAPI, SQLAlchemy, APScheduler, python-jobspy, google-genai, python-docx, pypdf). Next.js 14.2 / React 18 / TypeScript / Tailwind 3.4 frontend. SQLite in WAL mode as the only datastore.
argos/specs/ARCHITECTURE.md:19:                        └── google-genai ──▶ gemini-2.5-flash
argos/specs/ARCHITECTURE.md:30:Wraps `python-jobspy`. `FULL_SITES = ["indeed", "linkedin"]` are scraped in production; `ALL_SITES` also includes `zip_recruiter` and `google` but they're excluded via `FLAKY_SITES` guard. Concurrent scrapes (`ThreadPoolExecutor`) per (site, term) pair. Every active `SearchTerm` is queried. Upserts via `upsert_job()` → deterministic `Job.make_id`. Jobs not re-seen for `STALE_DAYS=14` are marked `is_active=False`.
argos/specs/ARCHITECTURE.md:97:- **LLM:** Gemini `gemini-2.5-flash` via `google-genai`. `thinking_budget=0` (no reasoning tokens).
argos/specs/ARCHITECTURE.md:118:- **LLM providers other than Gemini.** `tailor.py` imports `google.genai` directly with no abstraction layer.
```

All matches are `google-genai`/`google.genai` package references or the system-shape diagram, plus the permitted `## Components` paragraph (L30). No `## Known drift` bullet contains `google`. PASS.

**#4 — `## Known drift` header survives, exactly one bullet remains.**

```
$ awk '/^## Known drift/,/^## /{print}' argos/specs/ARCHITECTURE.md | grep -c '^- '
1
$ grep -n "^## Known drift" argos/specs/ARCHITECTURE.md
120:## Known drift
```

PASS.

**#5 — Surviving bullet is the Dockerfile / production-deploy one.**

```
$ grep -n "docker-compose does not build the frontend" argos/specs/ARCHITECTURE.md
124:- **docker-compose does not build the frontend.** Only `./backend` is a service. `frontend/` has no Dockerfile. README's "Run" section treats this as intentional (two separate commands), but it means there is no one-command production start.
```

Exactly one match, inside `## Known drift` section. PASS.

**#6 — All 8 ARCHITECTURE.md top-level sections intact.**

```
$ grep -c "^## " argos/specs/ARCHITECTURE.md
8
$ grep -n "^## " argos/specs/ARCHITECTURE.md
8:## System shape
24:## Components
56:## Contracts
79:## Invariants
92:## Technology choices
102:## Code style
111:## What this architecture deliberately does not support
120:## Known drift
```

Order and count match plan exactly. PASS.

**#7 — All 9 PRD.md top-level sections intact.**

```
$ grep -c "^## " argos/specs/PRD.md
9
$ grep -n "^## " argos/specs/PRD.md
7:## One-line pitch
11:## Problem
15:## Target user
19:## Goals
30:## Non-goals
36:## Success metrics
46:## Constraints
54:## Open questions
61:## Out-of-band context
```

Order and count match plan exactly. PASS.

**#8 — PRD `## Out-of-band context` lost the drift pointer; deploy-target and IT/Dev bullets kept.**

```
$ awk '/^## Out-of-band context/,0' argos/specs/PRD.md | grep -c '^- '
2
$ grep -n "Known doc drift" argos/specs/PRD.md
(no output, exit 1)
$ grep -n "Intended deploy target is a home server" argos/specs/PRD.md
63:- Intended deploy target is a home server ("hserver-1" — see Success metrics). The repo does not yet contain deployment artifacts for it; current docker-compose assumes the operator runs it interactively on localhost.
$ grep -n "prior \"IT / Dev resume\" schema" argos/specs/PRD.md
64:- The codebase shows evidence of a prior "IT / Dev resume" schema (see `backend/migrate.py` docstring, and dead `IT_RESUME_PATH` / `DEV_RESUME_PATH` entries in `.env.example`). The current schema is generic multi-resume; any references to two hardcoded resume slots are historical.
```

Exactly 2 bullets remain; "Known doc drift" pointer is gone; the other two are intact. PASS.

**#9 — Diff scope limited to spec docs.**

```
$ git diff --name-only
argos/specs/ARCHITECTURE.md
argos/specs/PRD.md
argos/specs/STATE.md

$ git diff --stat
 argos/specs/ARCHITECTURE.md | 5 -----
 argos/specs/PRD.md          | 1 -
 argos/specs/STATE.md        | 2 +-
 3 files changed, 1 insertion(+), 7 deletions(-)

$ git diff -- backend/ frontend/ README.md .env.example docker-compose.yml
(no output, exit 0)
```

Tracked-file changes are confined to `argos/specs/`. ARCHITECTURE.md: net 5 deletions (the 5 closed-drift bullets), 0 insertions. PRD.md: net 1 deletion (the closed-drift pointer), 0 insertions. STATE.md was modified at ticket-creation time (added JH-006 to the queue) — it is properly the verifier's job to revert that on pass; no source/code/README/compose/env files touched. The untracked ticket file itself appears in `git status` but is not yet tracked. PASS.

**#10 — Markdown well-formedness in edited files.**

```
$ python3 -c 'import sys; t=open("argos/specs/ARCHITECTURE.md").read(); assert t.count("`")%2==0, "unbalanced backticks"; assert t.count("[")==t.count("]"), "unbalanced brackets"; assert t.count("(")==t.count(")"), "unbalanced parens"; print("ARCHITECTURE.md: PASS")'
ARCHITECTURE.md: PASS
$ python3 -c 'import sys; t=open("argos/specs/PRD.md").read(); assert t.count("`")%2==0, "unbalanced backticks"; assert t.count("[")==t.count("]"), "unbalanced brackets"; assert t.count("(")==t.count(")"), "unbalanced parens"; print("PRD.md: PASS")'
PRD.md: PASS
```

PASS.

**#11 — Chaos probe `state` returns `state: PASS`.**

```
$ bash argos/scripts/argos-chaos-probe.sh state
state: PASS
EXIT=0
```

PASS.

### Regression scan

This is a docs-only edit; no code under `backend/` or `frontend/` is modified (verified by `git diff -- backend/ frontend/ README.md .env.example docker-compose.yml` returning empty). No callers of any function are altered. No test suite exists in this repo (acknowledged in `argos/specs/PRD.md` Open questions); the acceptance commands above are the test plan. No regression risk introduced.

### Status

**Status: READY**

### Proposed STATE.md diff (parent applies — verifier does not write)

Remove JH-006 from `## Queue` (revert to `_none_`) and prepend it to `## Done this cycle` (newest-on-top, above JH-005). `## Known drift` stays at `_none_`. `**Last updated:**` already 2026-04-26.

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@ _One sentence. What is the single most important thing in flight right now? If y
 
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.
 
-- [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
+- _none_
 
 ## In progress
 
@@ -25,6 +25,7 @@ Tickets currently being executed by the loop or paused mid-cycle. At most one pe
 
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.
 
+- 2026-04-26 — [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
 - 2026-04-26 — [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
 - 2026-04-26 — [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
 - 2026-04-26 — [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
```

This ticket closes Phase 1's drift-cleanup arc. The repo's docs and code are now consistent for the items JH-001..JH-006 covered.
