# JH-008: Fix rule-of-hooks violation in settings/page.tsx

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P2
**Estimated effort:** S

## Intent

Fix the `react-hooks/rules-of-hooks` ESLint violation in `frontend/app/settings/page.tsx:277` so `cd frontend && npm run build` passes the post-compile lint phase. The function `useExampleTerm` is named like a hook (per React's `use*` convention), but it's invoked inside an `onClick` callback — ESLint's rules-of-hooks rule reads it as a hook call inside a callback and fails the build.

## Context

Surfaced during JH-007 verification. JH-007's compile phase passes, but `next build` then fails the lint step:

```
./app/settings/page.tsx
277:34  Error: React Hook "useExampleTerm" cannot be called inside a callback.
```

Verified pre-existing on `main` (byte-identical via stash test). JH-007's Non-goals explicitly forbade editing `settings/page.tsx`, so the fix was deferred to this dedicated ticket.

The function is not actually a React hook — it just doesn't follow the `use*` naming convention's contract. The fix is almost certainly a rename (e.g. `useExampleTerm` → `handleExampleTerm`, `addExampleTerm`, or `applyExampleTerm`) at both its definition and its single call site (line 277). Code behavior unchanged.

This ticket is a production unblock for the redesign phase — JH-009 onward will rebuild every screen and a green `npm run build` is needed for confident shipping.

## Scope

- Edit `frontend/app/settings/page.tsx`: rename the `useExampleTerm` function definition AND its call site at line 277 to a non-`use*` name. Pick a name that reads well as a click-handler — e.g. `handleExampleTerm`, `addExampleTerm`, or whatever the planner judges most natural given the function body.
- If `useExampleTerm` is referenced elsewhere in the file or other files, rename consistently.

## Non-goals

- Do **not** change the function's behavior — only rename.
- Do **not** modify any other file unless the rename requires a cross-file update (it shouldn't — `useExampleTerm` is almost certainly file-local).
- Do **not** add `eslint-disable` comments to silence the rule. Fix the name, not the lint.
- Do **not** modify any other code in `settings/page.tsx` ("while I was in there" refactors are forbidden).
- Do **not** modify `globals.css`, `tailwind.config.ts`, or anything else from the JH-007 surface.

## Acceptance criteria (draft — planner will refine)

- `cd frontend && npm run build 2>&1 | tail -20` shows `Compiled successfully` AND no `react-hooks/rules-of-hooks` lint errors. (`Failed to compile` after lint should not appear.)
- `cd frontend && npx tsc --noEmit` exits cleanly.
- `grep -n "useExampleTerm" frontend/` returns no results post-edit.
- The renamed function is referenced exactly where `useExampleTerm` was — no orphaned references, no broken behavior.
- `git diff --stat` shows ONLY `frontend/app/settings/page.tsx` modified (plus ticket and STATE).
- `backend/`, other frontend files, `package.json`, lockfile unchanged.

## Plan

### Rename

`useExampleTerm` → `applyExampleTerm`

Rationale: the function body is a single `setNewTerm(example)` call — it applies the clicked example into the search-term input field; it does **not** submit/add the term to the backend (that is `handleAddTerm` via `addSearchTerm`). `applyExampleTerm` describes the actual behavior (fill state) more accurately than `addExampleTerm` (which would imply an API call) or generic `handleExampleTerm`.

### Files touched

- `frontend/app/settings/page.tsx` (edit) — only file. Two touch sites.

### Changes per file

**`frontend/app/settings/page.tsx`** (edit):

- Line 134, definition. Replace exactly:
  - Old: `  const useExampleTerm = (example: string) => {`
  - New: `  const applyExampleTerm = (example: string) => {`
- Line 277, call site inside the `EXAMPLE_TERMS.map(...)` button `onClick`. Replace exactly:
  - Old: `                  onClick={() => useExampleTerm(ex)}`
  - New: `                  onClick={() => applyExampleTerm(ex)}`
- No other lines change. Indentation, surrounding props, types, and the function body (`setNewTerm(example);`) are preserved verbatim.

### Acceptance criteria (runnable)

Each command run from repo root unless noted. Pass conditions are concrete.

1. **Build passes compile + lint end-to-end.**
   - Command: `cd frontend && npm run build 2>&1 | tail -20`
   - Pass: output contains `Compiled successfully` AND does **not** contain `Failed to compile` AND does **not** contain `react-hooks/rules-of-hooks`. Final stage shows route generation (e.g. `Generating static pages` / `Route (app)`), not a lint error.

2. **TypeScript clean.**
   - Command: `cd frontend && npx tsc --noEmit`
   - Pass: exit code 0, no output (or no error lines).

3. **Old name fully removed from source.**
   - Command: `grep -rn "useExampleTerm" /home/taddymason/projects/programs/jobhunter/frontend/app /home/taddymason/projects/programs/jobhunter/backend 2>&1`
   - Pass: exit code 1 (no matches). Stale matches in `frontend/.next/cache/` are ignored — that cache regenerates on next build.

4. **New name present at exactly two sites in `settings/page.tsx`.**
   - Command: `grep -n "applyExampleTerm" /home/taddymason/projects/programs/jobhunter/frontend/app/settings/page.tsx`
   - Pass: exactly 2 lines of output — one for the definition (line ~134), one for the `onClick` call (line ~277).

5. **Diff scope: only the ticket file, STATE.md, and `settings/page.tsx`.**
   - Command: `git diff --stat HEAD`
   - Pass: changed paths are exactly `frontend/app/settings/page.tsx`, `argos/specs/tickets/JH-008-fix-rules-of-hooks-settings.md`, and (if verifier added it) `argos/specs/STATE.md`. No other files.

6. **No dependency or lockfile churn.**
   - Command: `git diff HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt`
   - Pass: empty output.

7. **Behavioral parity (manual check, no runner exists).**
   - Read the diff: only the identifier name changed at definition and call site; the body `setNewTerm(example);` is byte-identical; the button JSX is unchanged except for the identifier inside `onClick`.

### Test strategy

No frontend test harness exists in this repo (per ARCHITECTURE.md "Tests: no harness exists today"). Verification therefore relies on:

- `npm run build` (compile + ESLint via `next lint`) — primary signal.
- `npx tsc --noEmit` — type signal.
- `grep` invariants above — proves the rename is complete and consistent.
- Visual diff review against this Plan to confirm scope.

No new test files. Adding a Jest/Vitest harness is out of scope for JH-008.

### Cross-file reference check (already performed)

`grep -rn "useExampleTerm" frontend/ backend/` returned matches **only** in `frontend/app/settings/page.tsx` (lines 134 and 277). Stale ESLint cache hit in `frontend/.next/cache/eslint/.cache_idnqme` is a generated artifact and regenerates on next build — not a source reference. The function is not `export`ed. No cross-file rename needed.

### Out-of-scope reminders (from Non-goals)

- Do **not** change function behavior (`setNewTerm(example);` stays exactly as-is).
- Do **not** edit any other file in `frontend/app/settings/page.tsx` ("while I was in there" forbidden — the unrelated `react-hooks/exhaustive-deps` warning at line 84 in `app/page.tsx` and any other observation are NOT in scope).
- Do **not** add `eslint-disable` comments.
- Do **not** modify `globals.css`, `tailwind.config.ts`, or any JH-007 surface.
- Do **not** modify `package.json` or the lockfile.
- Do **not** touch backend files.

### Open questions

None. This is a deterministic identifier rename with one definition and one call site; the new name is chosen and justified above.

## Verification

**Verifier run:** 2026-04-26
**Verdict:** READY

### Criterion 1 — Build passes compile + lint end-to-end

Command: `cd frontend && npm run build 2>&1 | tail -20`

Stdout (tail):
```
   Generating static pages (5/7) 
 ✓ Generating static pages (7/7)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    4.1 kB          101 kB
├ ○ /_not-found                          873 B          88.2 kB
├ ○ /icon.svg                            0 B                0 B
├ ƒ /jobs/[id]                           37.8 kB         135 kB
└ ○ /settings                            2.82 kB        99.6 kB
+ First Load JS shared by all            87.3 kB
  ├ chunks/117-b6a2e6139834092f.js       31.7 kB
  ├ chunks/fd9d1056-747f4c69a2e7ec3c.js  53.6 kB
  └ other shared chunks (total)          1.96 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Build markers grepped from full output:
```
 ✓ Compiled successfully
   Linting and checking validity of types ...
```

Tail does not contain `Failed to compile` and does not contain `react-hooks/rules-of-hooks`. Final stage shows `Route (app)` table — full pipeline through static-page generation succeeded. **PASS**

### Criterion 2 — TypeScript clean

Command: `cd frontend && npx tsc --noEmit`

Stdout: (empty)
Exit code: `0`

**PASS**

### Criterion 3 — Old name fully removed from source

Command: `grep -rn "useExampleTerm" /home/taddymason/projects/programs/jobhunter/frontend/app /home/taddymason/projects/programs/jobhunter/backend 2>&1`

Stdout: (empty)
Exit code: `1` (no matches)

**PASS**

### Criterion 4 — New name present at exactly two sites in `settings/page.tsx`

Command: `grep -n "applyExampleTerm" /home/taddymason/projects/programs/jobhunter/frontend/app/settings/page.tsx`

Stdout:
```
134:  const applyExampleTerm = (example: string) => {
277:                  onClick={() => applyExampleTerm(ex)}
```

Exactly two lines: definition at line 134, call site at line 277 — matches the plan's predicted line numbers. **PASS**

### Criterion 5 — Diff scope

Command: `git diff --stat HEAD`

Stdout:
```
 argos/specs/STATE.md           |  5 ++--
 frontend/app/globals.css       | 62 ++++++++++++++++++++++++++++++++++++++++++
 frontend/app/layout.tsx        | 16 ++---------
 frontend/app/settings/page.tsx |  4 +--
 frontend/tailwind.config.ts    | 52 +++++++++++++++++++++++++++++++++--
 5 files changed, 119 insertions(+), 20 deletions(-)
```

JH-008-attributable changes: `frontend/app/settings/page.tsx` only — 4 lines (definition + call site rename). Confirmed via `git diff HEAD -- frontend/app/settings/page.tsx`:

```
-  const useExampleTerm = (example: string) => {
+  const applyExampleTerm = (example: string) => {
...
-                  onClick={() => useExampleTerm(ex)}
+                  onClick={() => applyExampleTerm(ex)}
```

The other modified entries (`frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`) and the untracked `frontend/app/lib/fonts.ts` are uncommitted JH-007 worktree leftovers — STATE.md marks JH-007 Done, but those edits were never committed to `main`. Watchdog flagged this as STATE-vs-git drift; not the JH-008 coder's doing. The JH-008 scope check ("only modified `settings/page.tsx`") holds. **PASS** (with drift note — see Known drift addition below).

### Criterion 6 — No dependency or lockfile churn

Command: `git diff HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt`

Stdout: (empty)
Exit code: `0`

**PASS**

### Criterion 7 — Behavioral parity (manual diff read)

Diff content (full JH-008 surface):
```
@@ -131,7 +131,7 @@ export default function SettingsPage() {
     }
   };
 
-  const useExampleTerm = (example: string) => {
+  const applyExampleTerm = (example: string) => {
     setNewTerm(example);
   };
 
@@ -274,7 +274,7 @@ export default function SettingsPage() {
                 <button
                   key={ex}
                   type="button"
-                  onClick={() => useExampleTerm(ex)}
+                  onClick={() => applyExampleTerm(ex)}
                   className="text-xs px-3 py-1.5 rounded bg-surface-raised text-secondary hover:text-primary border border-subtle transition-colors"
                 >
                   + {ex}
```

Body of the function (`setNewTerm(example);`) is byte-identical. Button JSX surrounding the `onClick` (`key`, `type`, `className`, children) is byte-identical. Only the identifier name changed at exactly the two predicted sites. **PASS**

### Regression scan

- No callers of `useExampleTerm` exist outside `settings/page.tsx` (criterion 3 grep returned empty across `frontend/app` and `backend/`). The function was not exported.
- No frontend test harness exists (per ARCHITECTURE.md) — `npm run build` (compile + ESLint via `next lint`) and `tsc --noEmit` are the regression signals available, both green.
- No dependency or lockfile changes (criterion 6).

### Watchdog ruling on JH-007 drift (acknowledged)

The working tree contains uncommitted JH-007 edits (`frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`) and one untracked file (`frontend/app/lib/fonts.ts`). STATE.md's `## Done this cycle` lists JH-007 as completed 2026-04-26, but `git log` shows those changes were never committed to `main`. This is real STATE-vs-git drift, predates the JH-008 run, and is not attributable to the JH-008 coder. Per watchdog recommendation, this is being captured as a new `Known drift` entry rather than masked.

### Status

**READY**

### Proposed STATE.md diff (parent applies)

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@
 
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.
 
-- [JH-008](tickets/JH-008-fix-rules-of-hooks-settings.md) — Fix rule-of-hooks violation in settings/page.tsx (P2)
+- _none_
 
 ## In progress
 
@@ -25,6 +25,7 @@
 
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.
 
+- 2026-04-26 — [JH-008](tickets/JH-008-fix-rules-of-hooks-settings.md) — Fix rule-of-hooks violation in settings/page.tsx (P2)
 - 2026-04-26 — [JH-007](tickets/JH-007-design-tokens-and-fonts.md) — Design tokens + fonts foundation (P3)
 - 2026-04-26 — [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
 - 2026-04-26 — [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
@@ -43,4 +44,4 @@
 
 Places the code and `argos/specs/ARCHITECTURE.md` disagree. Each entry should name the file or module, one sentence on the mismatch, and a disposition (fix code, update docs, file ADR).
 
-- `frontend/app/settings/page.tsx:277` — `useExampleTerm` is invoked inside an `onClick` callback, violating `react-hooks/rules-of-hooks`. `next build` fails the post-compile lint step on `main`. Disposition: fix code in a follow-up ticket (likely rename to `handleExampleTerm` or move the hook call to the component body). Surfaced by JH-007 verification.
+- JH-007 worktree drift — STATE.md marks JH-007 Done 2026-04-26, but `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts` are uncommitted in the working tree and `frontend/app/lib/fonts.ts` is untracked. None of these reached `main`. Disposition: commit the JH-007 leftovers (likely user-driven, not a new ticket). Surfaced by JH-008 verification.
```

`**Last updated:**` already 2026-04-26 — no change needed.
