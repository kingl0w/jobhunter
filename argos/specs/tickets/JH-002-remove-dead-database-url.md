# JH-002: Remove dead DATABASE_URL from docker-compose.yml

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** S

## Intent

Remove the dead `DATABASE_URL` environment variable from `docker-compose.yml`. It is set but never read — `backend/config.py` hardcodes `db_path="data/jobs.db"` and is the single source of truth for DB location.

## Context

`ARCHITECTURE.md` "Known drift" entry: `docker-compose.yml` line 12 sets `DATABASE_URL=sqlite:///./data/jobhunter.db`, but `backend/config.py` hardcodes `db_path="data/jobs.db"` and never reads `DATABASE_URL`. The env var is dead and the filenames don't even match.

Resolution direction (decided): remove the env var from compose. `config.py` stays as the single source of truth for DB location. This matches the ARCHITECTURE invariant that the app is single-user, self-hosted, and not designed for runtime DB-path configurability.

## Scope

- Remove the `- DATABASE_URL=...` line from `docker-compose.yml`'s backend service environment block.
- If removing that line leaves an empty `environment:` block with no other entries, also remove the empty block (don't leave dangling YAML keys).

## Non-goals

- Do **not** modify `backend/config.py`, `backend/database.py`, or any source code — `config.py` is already the source of truth and stays unchanged.
- Do **not** modify `.env` or `.env.example` — `DATABASE_URL` is not present there (verify before assuming).
- Do **not** update `ARCHITECTURE.md`'s Known drift section — verifier handles drift reconciliation as part of STATE update.

## Acceptance criteria (draft — planner will refine)

- `grep -n DATABASE_URL docker-compose.yml` returns no results.
- `grep -rn DATABASE_URL backend/ frontend/` returns no results (confirms nothing references the env var anywhere — it really was dead).
- `docker compose config` (parsing only, does not start anything) exits cleanly with no warnings about the file.
- `git diff --stat` shows ONLY `docker-compose.yml` modified (plus the ticket file and `STATE.md` from `/new-ticket` and verifier).
- Code under `backend/` and `frontend/` unchanged.

## Plan

### Files touched

- `docker-compose.yml` — **edit** (only file modified by this ticket).

### Changes per file

`docker-compose.yml` (current lines 11–12):

```
    environment:
      - DATABASE_URL=sqlite:///./data/jobhunter.db
```

- Delete line 12 (`      - DATABASE_URL=sqlite:///./data/jobhunter.db`).
- Delete line 11 (`    environment:`) — `DATABASE_URL` is the only entry under it, so removing the entry leaves a dangling YAML key. Per the ticket's Scope, dangling keys must not be left behind.
- Do not touch any other line. The `build`, `ports`, `env_file`, and `volumes` blocks (lines 1–10, post-edit lines 1–10) stay byte-identical.
- File ends after the `volumes:` block. Preserve the trailing newline.

Expected post-edit file (10 lines):

```
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./resumes:/app/resumes
      - ./data:/app/data
```

### Acceptance criteria (refined, runnable)

Each is a command the verifier runs from the repo root. Stated exit code / output is the pass condition.

1. **Env var gone from compose file.**
   `grep -n DATABASE_URL docker-compose.yml; test $? -eq 1`
   Pass: grep exits 1 (no match).

2. **Env var still absent from source.** (Sanity — premise of the ticket.)
   `grep -rn DATABASE_URL backend/ frontend/; test $? -eq 1`
   Pass: grep exits 1 (no match). Verified pre-edit; re-asserted post-edit.

3. **YAML still parses.**
   `python3 -c "import yaml,sys; yaml.safe_load(open('docker-compose.yml')); print('ok')"`
   Pass: prints `ok`, exits 0.

4. **Compose schema still valid.** Note: `docker compose config` on this repo errors on the missing `.env` file, which is unrelated to this ticket. Run with a temp empty `.env`:
   `touch .env.jh002.tmp && docker compose --env-file .env.jh002.tmp config >/dev/null; rc=$?; rm -f .env.jh002.tmp; test $rc -eq 0`
   Pass: rc is 0. (Replaces the ticket's draft criterion #3, which would always fail locally due to the unrelated missing-`.env` issue.)

5. **Backend service still has expected keys.**
   `python3 -c "import yaml; c=yaml.safe_load(open('docker-compose.yml')); s=c['services']['backend']; assert 'environment' not in s, 'environment block should be gone'; assert set(['build','ports','env_file','volumes']).issubset(s), s; print('ok')"`
   Pass: prints `ok`, exits 0.

6. **Diff scope.** Only `docker-compose.yml` (plus the ticket file and `STATE.md`, written by `/new-ticket` and the verifier) appear in `git diff --name-only` against the branch base.
   `git diff --name-only` — must include `docker-compose.yml` and must **not** include any path under `backend/` or `frontend/`.

7. **No source code touched.**
   `git diff --stat backend/ frontend/` — must be empty.

### Test strategy

No test runner exists in this repo (per `ARCHITECTURE.md` "Code style"), and this is a config-only edit — adding one for a one-line YAML deletion is out of scope. The acceptance-criteria commands above ARE the test plan; the verifier runs them in order and quotes real stdout. No new test file is created.

Commands to run, in order:

```
grep -n DATABASE_URL docker-compose.yml
grep -rn DATABASE_URL backend/ frontend/
python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml')); print('ok')"
touch .env.jh002.tmp && docker compose --env-file .env.jh002.tmp config >/dev/null; rc=$?; rm -f .env.jh002.tmp; echo "compose rc=$rc"
python3 -c "import yaml; c=yaml.safe_load(open('docker-compose.yml')); s=c['services']['backend']; assert 'environment' not in s; assert set(['build','ports','env_file','volumes']).issubset(s); print('ok')"
git diff --name-only
git diff --stat backend/ frontend/
```

### Open questions

None. Premises verified:

- `docker-compose.yml` line 12 holds the dead env var; line 11 (`environment:`) is its only sibling and must also be removed to avoid a dangling key.
- `grep -rn DATABASE_URL backend/ frontend/` returns no matches — the var really is dead.
- `.env` does not exist on this machine; `.env.example` does not contain `DATABASE_URL`. Ticket's "verify before assuming" passes.
- `backend/config.py` line 20 hardcodes `db_path: str = "data/jobs.db"`; the `database_url` property at line 37 is derived from `db_path`, not from any env var. Single source of truth, as the ticket asserts.

### Out-of-scope reminders (from ticket Non-goals)

- Do **not** modify `backend/config.py`, `backend/database.py`, or any source under `backend/` or `frontend/`.
- Do **not** modify `.env.example` (or create a `.env`) as part of this ticket. The temp `.env.jh002.tmp` used in acceptance criterion #4 must be deleted before commit; it must not appear in `git status`.
- Do **not** edit `ARCHITECTURE.md`'s Known drift section. The verifier handles drift reconciliation when it updates `STATE.md`.

## Verification

Verifier ran the seven acceptance-criteria commands from the Plan, in order, from the repo root. Real stdout quoted below.

### Criterion 1 — Env var gone from compose file

Command: `grep -n DATABASE_URL docker-compose.yml`

Stdout: _(empty)_
Exit code: `1`

**PASS.** grep emitted no lines and exited 1, meaning the string is no longer present in `docker-compose.yml`. Cross-checked by reading the file: it now ends at line 10 (`      - ./data:/app/data`) with no trailing `environment:` block. The diff confirms exactly two lines deleted (`    environment:` and `      - DATABASE_URL=sqlite:///./data/jobhunter.db`) and zero lines added.

### Criterion 2 — Env var still absent from source

Command: `grep -rn DATABASE_URL backend/ frontend/`

Stdout: _(empty)_
Exit code: `1`

**PASS.** No `DATABASE_URL` references anywhere in `backend/` or `frontend/`. Re-confirmed by a wider sweep `grep -rn DATABASE_URL . --exclude-dir=.git --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=node_modules --exclude-dir=.next` — the only remaining hits are in `argos/specs/` files (this ticket, `ARCHITECTURE.md` Known drift entry, `PRD.md`, `STATE.md`). Zero source-code or config references remain. Additionally verified no code path reads the var indirectly: `grep -rn "os.environ" backend/ | grep -i "DATABASE\|DB_"` and `grep -rn "os.getenv" backend/ | grep -i "DATABASE\|DB_"` both return no results.

### Criterion 3 — YAML still parses

Command: `python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml')); print('ok')"`

First attempt with `python3` from `$PATH` (`/home/taddymason/.graphify-venv/bin/python3`):

```
Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'yaml'
```

Per the coder's note, re-ran with `/usr/bin/python3` (system Python with `pyyaml`):

Stdout: `ok`
Exit code: `0`

**PASS.** `docker-compose.yml` parses as valid YAML. The first failure was a tooling artifact (`$PATH` venv does not have `pyyaml`), not a defect in the edit.

### Criterion 4 — Compose schema still valid

Command: `touch .env.jh002.tmp && docker compose --env-file .env.jh002.tmp config >/dev/null; rc=$?; rm -f .env.jh002.tmp; echo "compose rc=$rc"`

Stdout: `compose rc=1`

Diagnostic re-run with stderr captured:

```
env file /home/taddymason/projects/programs/jobhunter/.env not found: stat /home/taddymason/projects/programs/jobhunter/.env: no such file or directory
```

The `--env-file` flag controls variable-substitution context, but the in-service `env_file: - .env` directive in the compose file itself is resolved against the project root regardless and `.env` does not exist on this machine. This is the exact pre-existing tooling/local-state issue the plan flagged in the criterion's prose ("errors on the missing `.env` file, which is unrelated to this ticket"). To confirm the schema is valid post-edit, re-ran with a temporary empty `.env` in place:

```
touch .env && docker compose config; rc=$?; rm -f .env; echo "rc=$rc"
```

Output (excerpt):

```
name: jobhunter
services:
  backend:
    build:
      context: /home/taddymason/projects/programs/jobhunter/backend
      dockerfile: Dockerfile
    networks:
      default: null
    ports:
      - mode: ingress
        target: 8000
        published: "8000"
        protocol: tcp
    volumes:
      - type: bind
        source: /home/taddymason/projects/programs/jobhunter/resumes
        target: /app/resumes
        bind: {}
      - type: bind
        source: /home/taddymason/projects/programs/jobhunter/data
        target: /app/data
        bind: {}
networks:
  default:
    name: jobhunter_default
```

`compose-with-empty-.env rc=0`. The rendered config has no `environment:` block on the `backend` service, exactly as intended.

**PASS (with caveat).** As written, the criterion's command yields rc=1 because of the missing `.env` (a local-state issue, not a defect). Schema validity post-edit is confirmed via the diagnostic re-run with an empty `.env`. Treating this as PASS per the criterion's own stated rationale; the temporary `.env` was created and immediately deleted, leaving no artifact.

Tooling availability: `docker compose version` → `Docker Compose version v5.1.0` (available — no SKIP needed). `.env.jh002.tmp` was created and removed; not present in `git status`.

### Criterion 5 — Backend service still has expected keys

Command: `python3 -c "import yaml; c=yaml.safe_load(open('docker-compose.yml')); s=c['services']['backend']; assert 'environment' not in s; assert set(['build','ports','env_file','volumes']).issubset(s); print('ok')"`

Re-ran with `/usr/bin/python3` (same `pyyaml` reason as criterion 3).

Stdout: `ok`
Exit code: `0`

**PASS.** Both assertions hold: (a) `environment` key is gone from the backend service, and (b) `build`, `ports`, `env_file`, `volumes` all remain. No dangling keys.

### Criterion 6 — Diff scope

Command: `git diff --name-only`

Stdout:
```
argos/specs/STATE.md
docker-compose.yml
```

`docker-compose.yml` appears (the intended edit). `argos/specs/STATE.md` appears because `/new-ticket` added the JH-002 queue entry and bumped the date; `git diff argos/specs/STATE.md` shows only those two semantic changes. No path under `backend/` or `frontend/` is present.

`git status --short` additionally shows the ticket file as untracked (`?? argos/specs/tickets/JH-002-remove-dead-database-url.md`) — expected, since `/new-ticket` created it. No `.env.jh002.tmp` artifact remains.

**PASS.**

### Criterion 7 — No source code touched

Command: `git diff --stat backend/ frontend/`

Stdout: _(empty)_
Exit code: `0`

**PASS.** Zero lines changed under `backend/` or `frontend/`. Source code is byte-identical to HEAD.

### Acceptance criteria summary

| # | Criterion | Status |
|---|---|---|
| 1 | `DATABASE_URL` removed from `docker-compose.yml` | PASS |
| 2 | `DATABASE_URL` still absent from `backend/`+`frontend/` | PASS |
| 3 | YAML still parses | PASS (after switching to `/usr/bin/python3` per coder note) |
| 4 | Compose schema still valid | PASS (with caveat — rc=1 from missing `.env`, schema validity confirmed via diagnostic re-run; the criterion's command as written is sensitive to local `.env` state) |
| 5 | Backend service shape preserved (no `environment`; keeps `build`/`ports`/`env_file`/`volumes`) | PASS |
| 6 | Diff scope limited to `docker-compose.yml` (+ `STATE.md` + ticket file) | PASS |
| 7 | No source code touched | PASS |

### Regression scan

- Repo-wide grep for `DATABASE_URL` (excluding `.git`, `venv`, `__pycache__`, `node_modules`, `.next`): only Argos spec files (`STATE.md`, `ARCHITECTURE.md`, `PRD.md`, this ticket) match. Zero live code or config references.
- `grep -rn "os.environ" backend/ | grep -i "DATABASE\|DB_"` → no results.
- `grep -rn "os.getenv" backend/ | grep -i "DATABASE\|DB_"` → no results.
- `db_path` source-of-truth chain intact: `backend/config.py:20` (`db_path: str = "data/jobs.db"`) → `backend/config.py:31` (`_resolve`) → `backend/config.py:38` (`database_url` property derived from `db_path`) → `backend/database.py:10` (`Path(settings.db_path).parent.mkdir(...)`). No callers of removed config; nothing to break.
- No test runner in repo (per `ARCHITECTURE.md` "Code style"), so "full test suite" is not applicable. The seven criteria above are the test plan, as the Plan stipulates.
- Conclusion: removing the dead env var is a true no-op for runtime behavior. Regression risk: none.

### Drift reconciliation

`ARCHITECTURE.md` line 125 still carries the Known drift entry: "**docker-compose vs config.** `docker-compose.yml` sets `DATABASE_URL=sqlite:///./data/jobhunter.db`. `backend/config.py` hardcodes `db_path="data/jobs.db"` and does not read `DATABASE_URL`. The env var is dead, and the filenames don't even match." This drift is now closed by this ticket. Per the ticket's Non-goals ("Do not update ARCHITECTURE.md's Known drift section — verifier handles drift reconciliation as part of STATE update"), the verifier does not edit `ARCHITECTURE.md` directly here; the parent should remove that bullet from `ARCHITECTURE.md` line 125 in the same PR (proposed text below). `PRD.md` line 65 ("`docker-compose.yml` sets `DATABASE_URL` but `config.py` ignores it") is also now stale and should be revised in a follow-up cleanup ticket; flagging but not proposing a change here since `PRD.md` was not in scope.

`STATE.md`'s "Known drift" section currently reads `_none_`, so there is nothing to remove from STATE — only to ensure we do not add this drift back.

### STATE.md proposed diff

```
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -1,6 +1,6 @@
 # jobhunter — State

-**Last updated:** 2026-04-26
+**Last updated:** 2026-04-26
 **Updated by:** _verifier (automated) or human (on hotfix)_

 This file is the project's short-term memory. Every subagent reads it first. Only the verifier writes it during the loop; humans write it on out-of-loop edits.
@@ -13,7 +13,7 @@ _One sentence. What is the single most important thing in flight right now? If y

 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.

-- [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
+- _none_

 ## In progress

@@ -25,6 +25,7 @@ Tickets currently being executed by the loop or paused mid-cycle. At most one pe

 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.

+- 2026-04-26 — [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
 - 2026-04-24 — [JH-001](tickets/JH-001-readme-gemini-api-key.md) — Fix README API key drift: ANTHROPIC_API_KEY → GEMINI_API_KEY (P3)

 ## Open decisions
```

Notes on the diff:
- `**Last updated:**` is already `2026-04-26` in the current file (set when `/new-ticket` ran today), so no change is required there. Listed as a no-op hunk only for clarity; the parent may drop it.
- `## Queue` flips from the JH-002 entry back to `_none_` (no other queued tickets).
- `## Done this cycle` gains a new top entry for JH-002 above the existing JH-001 entry.
- `## Known drift` stays at `_none_` — JH-002 closed an existing drift; it did not introduce one.

### ARCHITECTURE.md proposal (NOT applied — flagged for parent decision)

The ticket's Non-goals tell the verifier not to touch `ARCHITECTURE.md` directly. However, the docker-compose Known drift bullet on line 125 of `ARCHITECTURE.md` is now factually wrong. Recommended: in the same PR, the parent should delete that bullet (the third bullet in `## Known drift`, starting with "**docker-compose vs config.**"). If the parent prefers to defer, file a follow-up cleanup ticket — but do not let the bullet linger past this PR, because it will mislead future planners reading the canonical architecture doc.

### Status

**READY.**

All seven acceptance criteria pass. Criterion 4 required a diagnostic re-run to confirm post-edit schema validity (the literal command yields rc=1 because of a pre-existing missing `.env` on this machine, which the plan itself anticipated and flagged as out-of-scope local state). No source files were touched. Diff scope is exactly what the plan specified. Regression risk is zero.
