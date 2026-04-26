# JH-004: Remove zip_recruiter and google from frontend source filter

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** S

## Intent

Remove `zip_recruiter` and `google` from the frontend source filter. The UI advertises filters for sources the scraper does not produce — code is the source of truth, so the filter should only offer what `backend/fetcher.py`'s `FULL_SITES` actually scrapes.

## Context

`ARCHITECTURE.md` "Known drift" entry: `frontend/app/page.tsx` exposes a source filter with options including `zip_recruiter` and `google`. `backend/fetcher.py` scrapes only `FULL_SITES = ["indeed", "linkedin"]` in production — `zip_recruiter` and `google` are excluded via the `FLAKY_SITES` guard. The UI offers filters for sources that produce no rows.

Resolution direction (decided): remove the unsupported options from the frontend filter. Code stays the source of truth — the UI advertises only what the scraper actually produces.

## Scope

- Edit `frontend/app/page.tsx`: remove `zip_recruiter` and `google` from whatever data structure or UI element drives the source filter (likely a hardcoded array, select options, or constant).
- If the same list appears in any shared types or constants file (`frontend/app/types.ts` or similar), update it there too.
- If removing options leaves the filter with only "indeed" and "linkedin" as choices, that is correct end state — do not collapse the filter UI itself, just trim the list.

## Non-goals

- Do **not** modify `backend/fetcher.py` — `FULL_SITES` is already correct.
- Do **not** add the disabled sources behind a feature flag — out of scope.
- Do **not** update `ARCHITECTURE.md`'s Known drift section — deferred to Phase 1 closeout.

## Acceptance criteria (draft — planner will refine)

- `grep -rn -E "zip_recruiter|google" frontend/app/` returns no results (or only results inside a comment that explains why they were removed).
- The two remaining options (`indeed` and `linkedin`) still render correctly — verified by reading the relevant component file.
- `cd frontend && npx tsc --noEmit` exits cleanly (no TypeScript errors introduced by the edit).
- `git diff --stat` shows ONLY frontend files modified (plus ticket and STATE).
- `backend/` unchanged.
- No `package.json` or lockfile changes.

## Plan

### Investigation summary

Source filter ground-truth, after `grep -rn -E "zip_recruiter|google"` against `frontend/app/` (node_modules excluded):

- `frontend/app/page.tsx:52` — local `useState` type union literal.
- `frontend/app/page.tsx:293-294` — `<option>` elements inside the source `<select>`.
- `frontend/app/components/job-card.tsx:16-17` — `SITE_COLORS` lookup map keyed by `job.site` (a defensive color dictionary; the consumer at line 65 has a `|| "bg-surface-raised text-secondary"` fallback, so removing these entries is safe).
- `frontend/app/layout.tsx:2` — `import { Space_Grotesk, Inter } from "next/font/google";` — **unrelated** to the source filter (Next.js Google Fonts import). Do NOT touch.

`frontend/app/types.ts` does NOT narrow `Job.site` (it's typed `string`), so no type-level work is needed there. `frontend/app/api.ts` does not reference the source list. `frontend/app/jobs/[id]/page.tsx` only renders `{job.site}` as a string — no hardcoded list. `frontend/app/settings/page.tsx` is unrelated.

Backend sanity check (`backend/fetcher.py`): `FULL_SITES = ["indeed", "linkedin"]` (line 18); `FLAKY_SITES = {"google", "zip_recruiter"}` (line 109) excludes them in production. Ticket premise confirmed. Backend stays untouched.

`frontend/tsconfig.json` exists and `frontend/node_modules/.bin/tsc` is installed — `cd frontend && npx tsc --noEmit` will run as expected.

### Files touched

1. **edit** `frontend/app/page.tsx`
2. **edit** `frontend/app/components/job-card.tsx`

No other files. No `types.ts`, `api.ts`, `layout.tsx`, or backend changes. No `package.json` changes.

### Changes per file

#### `frontend/app/page.tsx` (edit)

- **Line 52** — Narrow the `source` state type union by removing the two unsupported literals.
  - Old: `const [source, setSource] = useState<"all" | "indeed" | "linkedin" | "zip_recruiter" | "google">("all");`
  - New: `const [source, setSource] = useState<"all" | "indeed" | "linkedin">("all");`
- **Lines 293-294** — Delete the two `<option>` elements for `zip_recruiter` and `google`. Leave the surrounding `<select>` element, the "All Sources" / "Indeed" / "LinkedIn" options, and adjacent UI intact (the filter UI scaffold stays per ticket scope).
  - Delete lines 293 (`<option value="zip_recruiter">ZipRecruiter</option>`) and 294 (`<option value="google">Google</option>`) verbatim.

No other edits to `page.tsx`. The filter logic at line 128-130 (`if (source !== "all") { result = result.filter((j) => j.site === source); }`) needs no change — string-equality on `j.site` still works for any value, and a stale row whose `site === "zip_recruiter"` will simply be unreachable from the UI (correct).

#### `frontend/app/components/job-card.tsx` (edit)

- **Lines 16-17** — Remove the `zip_recruiter` and `google` entries from `SITE_COLORS`. The fallback at line 65 (`${SITE_COLORS[job.site] || "bg-surface-raised text-secondary"}`) already covers any unknown site key, so any historical rows with those `site` values will render with the neutral fallback color — acceptable.
  - Delete line 16 (`zip_recruiter: "bg-green-500/20 text-green-200",`) and line 17 (`google: "bg-orange-500/20 text-orange-200",`) verbatim.

After both edits, `grep -rn -E "zip_recruiter|google" frontend/app/` returns only the unrelated `next/font/google` import in `layout.tsx`.

### Acceptance criteria (refined, runnable)

Run from repo root unless noted.

1. `grep -rn -E "zip_recruiter" frontend/app/` — **PASS** if exit code 1 (no matches).
2. `grep -rn -E "google" frontend/app/` — **PASS** if the ONLY match is `frontend/app/layout.tsx:2:import { Space_Grotesk, Inter } from "next/font/google";`. No matches in `page.tsx` or `job-card.tsx`.
3. `grep -n "indeed\|linkedin" frontend/app/page.tsx` — **PASS** if `<option value="indeed">Indeed</option>` and `<option value="linkedin">LinkedIn</option>` are still present (the filter scaffold survives).
4. `cd frontend && npx tsc --noEmit` — **PASS** if exit code 0 with no stdout/stderr errors.
5. `git diff --stat` — **PASS** if modified files are exactly: `frontend/app/page.tsx`, `frontend/app/components/job-card.tsx`, `argos/specs/tickets/JH-004-remove-unsupported-source-filters.md`, `argos/specs/STATE.md` (STATE updated by verifier per Argos rules). No other files.
6. `git diff -- backend/` — **PASS** if exit code 0 and empty output (backend untouched).
7. `git diff -- frontend/package.json frontend/package-lock.json` — **PASS** if empty (no dep changes).

### Test strategy

No test harness exists in this project (per `ARCHITECTURE.md` Code style: "Tests: no harness exists today"). Verification is mechanical:

- **Type check:** `cd frontend && npx tsc --noEmit` (sole automated gate).
- **Static greps:** the seven acceptance commands above.
- **Visual smoke (optional, not required to pass):** `cd frontend && npm run dev` → load `http://localhost:3000`, open the Source `<select>`, confirm only `All Sources / Indeed / LinkedIn` are present. The verifier may skip this; the type check + greps are sufficient.

### Open questions

None. Investigation confirmed:
- The source list lives in exactly two source files (`page.tsx` + `job-card.tsx`), not in a shared types/constants module.
- `Job.site` is typed `string`, not a narrowed union — no type narrowing needed in `types.ts`.
- `google` appears in one unrelated location (`layout.tsx` Google Fonts import) — that match must be preserved.
- The filter `<select>` UI scaffold remains; only the two `<option>` children are removed (per ticket scope).

### Out-of-scope reminders (from ticket Non-goals)

- Do **not** modify `backend/fetcher.py` — `FULL_SITES` is already correct.
- Do **not** add the disabled sources behind a feature flag.
- Do **not** update `ARCHITECTURE.md`'s Known drift section — deferred to Phase 1 closeout.
- Do **not** touch `frontend/app/layout.tsx` — its `next/font/google` import is the Next.js Google Fonts loader, unrelated to the source filter.
- Do **not** add or remove any dependency. No `package.json` / `package-lock.json` diff.
- Do **not** rename or restructure adjacent code in `page.tsx` or `job-card.tsx` ("while I was in there" refactors are forbidden by Argos rules).

## Verification

**Verifier run:** 2026-04-26
**Method:** Ran the 7 acceptance commands from the Plan section verbatim, in order, from repo root. Real stdout quoted below.

### Acceptance criterion 1 — `grep -rn -E "zip_recruiter" frontend/app/`

```
$ grep -rn -E "zip_recruiter" frontend/app/
(no output)
exit 1
```

No matches anywhere in `frontend/app/`. **PASS.**

### Acceptance criterion 2 — `grep -rn -E "google" frontend/app/`

```
$ grep -rn -E "google" frontend/app/
frontend/app/layout.tsx:2:import { Space_Grotesk, Inter } from "next/font/google";
exit 0
```

Sole match is the unrelated Next.js Google Fonts import in `layout.tsx:2`, which the Plan explicitly whitelists. No matches in `page.tsx` or `job-card.tsx`. **PASS.**

### Acceptance criterion 3 — `grep -n "indeed\|linkedin" frontend/app/page.tsx`

```
$ grep -n "indeed\|linkedin" frontend/app/page.tsx
52:  const [source, setSource] = useState<"all" | "indeed" | "linkedin">("all");
291:            <option value="indeed">Indeed</option>
292:            <option value="linkedin">LinkedIn</option>
exit 0
```

Both surviving `<option>` elements still render. The state union is correctly narrowed to `"all" | "indeed" | "linkedin"`. The filter scaffold is intact per ticket scope. **PASS.**

### Acceptance criterion 4 — `cd frontend && npx tsc --noEmit`

```
$ cd frontend && npx tsc --noEmit
(no output)
exit 0
```

Clean typecheck, no errors. **PASS.**

### Acceptance criterion 5 — `git diff --stat`

```
$ git diff --stat
 argos/specs/STATE.md                 | 2 +-
 frontend/app/components/job-card.tsx | 2 --
 frontend/app/page.tsx                | 4 +---
 3 files changed, 2 insertions(+), 6 deletions(-)
```

Modified files: `argos/specs/STATE.md` (pre-existing Queue-add from `/new-ticket`), `frontend/app/components/job-card.tsx`, `frontend/app/page.tsx`. The ticket file itself is untracked (`?? argos/specs/tickets/JH-004-...`), confirmed via `git status --short`. No backend, types, api, layout, or settings files touched. Matches the Plan's expected file set exactly. **PASS.**

### Acceptance criterion 6 — `git diff -- backend/`

```
$ git diff -- backend/
(no output)
exit 0
```

Backend untouched. **PASS.**

### Acceptance criterion 7 — `git diff -- frontend/package.json frontend/package-lock.json`

```
$ git diff -- frontend/package.json frontend/package-lock.json
(no output)
exit 0
```

No dependency changes. **PASS.**

### Diff inspection (semantic check)

`git diff -- frontend/app/page.tsx frontend/app/components/job-card.tsx` confirms exactly the four edits the Plan promised:

- `page.tsx:52` — `useState` type union narrowed from `"all" | "indeed" | "linkedin" | "zip_recruiter" | "google"` to `"all" | "indeed" | "linkedin"`.
- `page.tsx:293-294` (now gone) — both `<option>` elements removed; surrounding `<select>` and "All Sources" / Indeed / LinkedIn options preserved.
- `job-card.tsx:16-17` (now gone) — `zip_recruiter` and `google` keys removed from `SITE_COLORS`. `indeed` and `linkedin` entries retained. The fallback at the consumer site (`|| "bg-surface-raised text-secondary"`) handles any historical row whose `site` is one of the removed values.

No drive-by edits, no rename/restructure. Filter logic at `page.tsx` (string equality on `j.site`) needed no change and was not touched.

### Regression scan

- `grep -n -E "zip_recruiter|google" frontend/app/api.ts frontend/app/types.ts` → exit 1, no matches. The dead source names were never present in the shared API/types modules and remain absent. No callers of the removed `SITE_COLORS` keys exist (the only consumer is the in-file lookup at `job-card.tsx`, which uses a string-keyed `Record<string, string>` with a fallback — type-safe by construction).
- `cd frontend && npx tsc --noEmit` exit 0 — type narrowing of the `source` state did not break any consumer (the equality check `j.site === source` widens to `string` comparison, so it remained valid).
- No test harness exists in the project (per `ARCHITECTURE.md` — "Tests: no harness exists today"); type check + greps are the full automated gate per the Plan's Test strategy.

### Stale doc note (informational, not a fix)

`argos/specs/ARCHITECTURE.md` line 128 still carries the now-resolved drift entry:

> - **Frontend source filter vs scraper.** `frontend/app/page.tsx` exposes a source filter with `zip_recruiter` and `google` options; `backend/fetcher.py` scrapes only `FULL_SITES = ["indeed", "linkedin"]` in production. The UI offers filters for sources that produce no data.

Per ticket Non-goals ("Do **not** update `ARCHITECTURE.md`'s Known drift section — deferred to Phase 1 closeout"), the verifier did **not** edit `ARCHITECTURE.md`. Flagging only — the user has a planned closeout ticket for this after JH-005. `STATE.md`'s `## Known drift` section was already `_none_` and stays that way.

### STATE.md diff (proposed for parent to apply)

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@
 
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.
 
-- [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
+- _none_
 
 ## In progress
 
@@ -25,6 +25,7 @@
 
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.
 
+- 2026-04-26 — [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
 - 2026-04-26 — [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
 - 2026-04-26 — [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
 - 2026-04-24 — [JH-001](tickets/JH-001-readme-gemini-api-key.md) — Fix README API key drift: ANTHROPIC_API_KEY → GEMINI_API_KEY (P3)
```

`**Last updated:**` is already `2026-04-26` and needs no change. `## Known drift` stays `_none_`. `## Current focus` and `## Open decisions` untouched.

### Status: READY
