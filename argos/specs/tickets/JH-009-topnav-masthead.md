# JH-009: Topnav masthead component

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** M

## Intent

Build the editorial Topnav (masthead) component and wire it into `app/layout.tsx` so it renders on every route. This is the visual anchor of the redesign: brand mark with accent `&`, three tabs (Jobs · Pipeline · Settings), sync status + button on the right. Built against the JH-007 design tokens and font stack (Fraunces, Inter, JetBrains_Mono).

## Context

Handoff spec — `jobhunter/design_handoff_jobhunter_redesign/README.md` lines 36-42, plus `app.jsx` and `styles.css` for exact token references. Summary:

- **Sticky 64px header**, full-width, with a 1px bottom rule (`var(--rule)`).
- **Brand mark** (left): `job&hunt` in italic Fraunces 26px/700, with the `&` glyph in accent ink-red (gold post-token-swap). Underneath / beside: a tag reading `A FIELD GUIDE · VOL. 04` in 9px mono uppercase, separated by a vertical hairline.
- **Tabs** (center-left): Jobs · Pipeline · Settings. Italic Fraunces 14px. Active tab has a 2px accent-red underline (`border-bottom`), inactive tabs are `var(--muted)`.
- **Sync status + button** (right): a small dot pip + `LAST SYNC TODAY` (or `LAST SYNC {when}`) mono caps text, plus a small `sync` button with a refresh icon. Dot pulses when syncing (`@keyframes pulse`).

The component replaces whatever nav lives in `app/layout.tsx` today. Existing screens (jobs list, job detail, settings) keep working — they're rebuilt against the editorial design in JH-011..JH-013.

**Pipeline tab caveat:** the `/pipeline` route doesn't exist yet (created in JH-014). Linking to `/pipeline` from the Topnav will 404 until JH-014 lands. Acceptable for the phase — the tab is part of the masthead's editorial identity per the handoff, and a 404 is preferable to either omitting the tab or shipping a stub route.

**Icons:** the handoff's full Icon set (Search, Refresh, Settings, Upload, Trash, Plus, Briefcase, Board, External, Wand) is extracted into a shared component in JH-010. For this ticket, inline the refresh-icon SVG directly in the Topnav file. JH-010 may later swap it out for the shared `<Icon name="refresh" />` API.

**Sync wiring:** the existing `frontend/app/page.tsx` already polls `getSyncStatus` every 3s while `running`. Topnav needs its own sync state because it renders globally — the existing per-page polling can stay in place for now (JH-011 rebuilds the jobs list against the new system). The Topnav should:
- Read sync status on mount via `getSyncStatus()`.
- Poll every 3s while `running`.
- POST `/sync` on button click via `triggerSync()`.
- Show "LAST SYNC {when}" using the timestamp from `getSyncStatus()` response, with the dot color/pulse reflecting the running state.

## Scope

- **NEW** `frontend/app/components/topnav.tsx` — client component, default export, renders the masthead.
- **Edit** `frontend/app/layout.tsx` — import `<Topnav />` and render it inside the `<body>` above the page content.
- Use the JH-007 design tokens — `--accent`, `--rule`, `--muted`, `--bg`, `--surface`, `--text`, font vars `--font-display` / `--font-body` / `--font-mono` — via the `ed-*` Tailwind aliases and `font-display` / `font-body` / `font-mono` classes.
- Inline the refresh-icon SVG in the Topnav file. No new icon component yet (deferred to JH-010).
- Active-tab detection via `usePathname()` from `next/navigation`. `/jobs/[id]` should keep "Jobs" active.
- Sync polling: own state in Topnav. Call `getSyncStatus()` on mount and every 3s while `running`. Call `triggerSync()` on click.
- Pulse animation for the sync dot via Tailwind `animate-pulse` or a CSS keyframe — pick the simpler.

## Non-goals

- Do **not** create the `/pipeline` route — that's JH-014. Tab link will 404 until then; document in Verification.
- Do **not** extract a shared `<Icon />` component — JH-010.
- Do **not** add a toast system — JH-010 (handoff names this as a primitive).
- Do **not** rebuild any screen yet — `app/page.tsx`, `app/jobs/[id]/page.tsx`, `app/settings/page.tsx` remain as-is (their existing nav, if any, is replaced by the global Topnav from `layout.tsx`).
- Do **not** remove the existing per-page sync UI in `app/page.tsx` — JH-011 handles that. Two sync indicators may temporarily coexist; that's acceptable.
- Do **not** add new dependencies (`next/navigation` ships with Next.js).
- Do **not** modify `backend/`, `app/api.ts`, `app/types.ts` — Topnav uses the existing API client as-is.
- Do **not** modify `globals.css` or `tailwind.config.ts` — JH-007 already supplies every token Topnav needs. If the planner finds a missing alias, flag it as an open question instead of expanding scope.

## Acceptance criteria (draft — planner will refine)

- `frontend/app/components/topnav.tsx` exists and exports a default React component.
- `frontend/app/layout.tsx` imports and renders `<Topnav />` above the page content slot.
- Topnav renders on all three live routes (`/`, `/jobs/[id]`, `/settings`) — verifiable by reading the route components or `npm run dev` smoke check.
- Active-tab underline logic is correct: `/` highlights "Jobs"; `/jobs/[anything]` highlights "Jobs"; `/pipeline` highlights "Pipeline" (even though the route 404s); `/settings` highlights "Settings".
- Sync button calls `triggerSync()`; dot pulses while sync is running; "LAST SYNC {when}" reflects real backend timestamp.
- Brand mark `job&hunt` renders in italic Fraunces with the `&` glyph in accent gold.
- `cd frontend && npm run build` reaches `Compiled successfully` AND completes lint without `react-hooks/rules-of-hooks` errors.
- `cd frontend && npx tsc --noEmit` exits cleanly.
- `git diff --stat` shows ONLY `frontend/app/components/topnav.tsx` (new) and `frontend/app/layout.tsx` (modified) — plus ticket and STATE. No other files.
- `backend/`, `argos/specs/ARCHITECTURE.md`, `README.md`, etc. unchanged.
- No `package.json` or lockfile changes.

## Plan

### Files touched

- `frontend/app/components/topnav.tsx` — **new** client component, default export.
- `frontend/app/layout.tsx` — **edit** (one-line import + one-line render insertion above `{children}`).

No other files. No `globals.css`, no `tailwind.config.ts`, no `api.ts`, no `types.ts`, no `package.json` changes.

### Component shape — `frontend/app/components/topnav.tsx` (new)

The Topnav is a client component (`"use client"` directive) with:
- Sync-status state (`SyncStatus | null`) and a `syncing` boolean derived from it.
- `useEffect` mount fetch via `fetchSyncStatus()` from `app/api.ts`.
- A 3s `setInterval` poll that runs only while `status === "running"`. The interval is started inside `handleSync` after `triggerSync()` resolves (mirroring the existing `app/page.tsx` pattern at lines 86–102) and is cleared when `status !== "running"`. On mount, if the initial fetched status is already `"running"`, also start polling.
- `handleSync` fires `triggerSync()` then begins the 3s poll.
- `usePathname()` from `next/navigation` to compute active tab. Mapping:
  - pathname `/` or starts-with `/jobs` → Jobs active.
  - pathname starts-with `/pipeline` → Pipeline active.
  - pathname starts-with `/settings` → Settings active.
  - else → none active.
- Pulse animation: use Tailwind built-in `animate-pulse` on the `.dot` element while `running`. (Prototype uses 1.4s @ 1↔0.4 opacity; Tailwind's is 2s @ 1↔0.5. Visually close, and the Non-goals forbid touching `globals.css` to add a custom keyframe. See "Open questions" below.)

The component file content the coder will produce (annotated; coder copies the JSX shape, not the comments):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSyncStatus, triggerSync } from "../api";
import type { SyncStatus } from "../types";

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 8a6 6 0 1 1-1.76-4.24" />
      <path d="M14 2v3.5h-3.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Topnav() {
  const pathname = usePathname();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchSyncStatus();
        setStatus(s);
        if (s.status !== "running") stopPoll();
      } catch {
        stopPoll();
      }
    }, 3000);
  }, [stopPoll]);

  useEffect(() => {
    let cancelled = false;
    fetchSyncStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.status === "running") startPoll();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [startPoll, stopPoll]);

  const onSync = async () => {
    if (status?.status === "running") return;
    try {
      await triggerSync();
      const s = await fetchSyncStatus();
      setStatus(s);
      startPoll();
    } catch {
      // swallow — keep masthead non-fatal
    }
  };

  const running = status?.status === "running";
  const errored = status?.status === "error";
  const dotState = running ? "running" : errored ? "error" : "idle";
  const dotColor = running
    ? "bg-ed-accent"
    : errored
    ? "bg-ed-red"
    : "bg-ed-green";
  const lastSyncLabel = running
    ? "syncing…"
    : `last sync ${fmtRelative(status?.finished_at ?? null)}`;

  const isJobs = pathname === "/" || pathname.startsWith("/jobs");
  const isPipeline = pathname.startsWith("/pipeline");
  const isSettings = pathname.startsWith("/settings");

  const tabClass = (active: boolean) =>
    `px-[18px] py-2 font-display italic text-[14px] font-semibold tracking-tight transition-colors duration-ed-fast border-b-2 -mb-px inline-flex items-center gap-2 ${
      active
        ? "text-ed-text border-ed-accent"
        : "text-ed-muted border-transparent hover:text-ed-text"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-ed-bg border-b border-ed-rule">
      <div className="max-w-[1440px] mx-auto h-16 px-8 flex items-center gap-7">
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-display italic font-bold text-[26px] tracking-[-0.04em] text-ed-text"
            style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
          >
            job<span className="text-ed-accent not-italic-noop italic px-px">&amp;</span>hunt
          </span>
          <span className="font-mono text-[9px] font-medium text-ed-muted tracking-[0.18em] uppercase pl-3 ml-1 border-l border-ed-rule">
            a field guide · vol. 04
          </span>
        </div>

        <nav className="flex items-center" aria-label="Primary">
          <Link href="/" className={tabClass(isJobs)} aria-current={isJobs ? "page" : undefined}>
            Jobs
          </Link>
          <Link href="/pipeline" className={tabClass(isPipeline)} aria-current={isPipeline ? "page" : undefined}>
            Pipeline
          </Link>
          <Link href="/settings" className={tabClass(isSettings)} aria-current={isSettings ? "page" : undefined}>
            Settings
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 font-mono text-[10px] text-ed-muted uppercase tracking-[0.12em]"
            data-state={dotState}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${dotColor} ${running ? "animate-pulse" : ""}`}
            />
            {lastSyncLabel}
          </div>
          <button
            onClick={onSync}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-ed-md bg-ed-surface text-ed-text border border-ed-border text-[12px] font-medium hover:bg-ed-surface-2 hover:border-ed-border-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
          >
            <RefreshIcon />
            {running ? "syncing" : "sync"}
          </button>
        </div>
      </div>
    </header>
  );
}
```

Notes for the coder:

- The `not-italic-noop italic` on the `&` span is wrong — drop it. Just `italic` is correct (the parent already has italic; the prototype CSS explicitly re-asserts `font-style: italic` on `.amp`, which is redundant in our cascade but harmless). The literal class string the coder should ship is `text-ed-accent italic px-px`.
- `&amp;` is a valid JSX child and renders the literal `&` character; do not change it to a bare `&` (the JSX parser will treat that as the start of an entity ref) and do not change it to `{"&"}`.
- Tailwind has no `animate-pulse-1400` preset; using built-in `animate-pulse` is intentional and consistent with the Non-goals.
- `Link` from `next/link` is used for tabs — clicking "Jobs" while already on `/jobs/[id]` should route to `/`. That matches the prototype's `setRoute({ name: "list", id: null })` semantics.

### Layout edit — `frontend/app/layout.tsx`

Exact edit:

`old_string`:
```
import type { Metadata } from "next";
import { fraunces, inter, jetbrainsMono } from "./lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "jobhunter",
  description: "Job search tracker and resume tailor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

`new_string`:
```
import type { Metadata } from "next";
import { fraunces, inter, jetbrainsMono } from "./lib/fonts";
import Topnav from "./components/topnav";
import "./globals.css";

export const metadata: Metadata = {
  title: "jobhunter",
  description: "Job search tracker and resume tailor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Topnav />
        {children}
      </body>
    </html>
  );
}
```

No parent has `overflow:hidden`; sticky positioning will work (body is the offset parent and is the document scroll container).

### Acceptance criteria

Run from repo root unless noted.

1. `test -f frontend/app/components/topnav.tsx` exits 0.
2. `grep -q '"use client"' frontend/app/components/topnav.tsx` exits 0.
3. `grep -q 'export default function Topnav' frontend/app/components/topnav.tsx` exits 0.
4. `grep -q 'usePathname' frontend/app/components/topnav.tsx` exits 0.
5. `grep -q 'fetchSyncStatus' frontend/app/components/topnav.tsx` AND `grep -q 'triggerSync' frontend/app/components/topnav.tsx` both exit 0.
6. `grep -q 'import Topnav' frontend/app/layout.tsx` exits 0 AND `grep -q '<Topnav />' frontend/app/layout.tsx` exits 0.
7. `cd frontend && npx tsc --noEmit` exits 0 with no output.
8. `cd frontend && npm run build` reaches `Compiled successfully`. ESLint output contains no `react-hooks/rules-of-hooks` errors and no errors referencing `app/components/topnav.tsx` or `app/layout.tsx`.
9. `git diff --stat HEAD` lists exactly these paths (plus the ticket file and `argos/specs/STATE.md` once the verifier writes it): `frontend/app/components/topnav.tsx` (new), `frontend/app/layout.tsx` (modified). No other code paths in the diff.
10. `git diff HEAD -- frontend/package.json frontend/package-lock.json` is empty.
11. `git diff HEAD -- frontend/app/globals.css frontend/tailwind.config.ts frontend/app/api.ts frontend/app/types.ts backend/ README.md argos/specs/ARCHITECTURE.md argos/specs/PRD.md` is empty.

### Test strategy

No test harness exists in `frontend/` (per ARCHITECTURE.md "Tests: no harness exists today"). Verification is therefore type-check + production build + diff-shape + manual smoke.

Verifier commands:

- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run build` and assert `Compiled successfully` is in stdout and `react-hooks/rules-of-hooks` is **not** in stdout.
- `git status --porcelain` and `git diff --stat HEAD` for the file-list invariant.

Manual smoke (run during verification, document outcome in Verification section):

- `cd frontend && npm run dev` and visit:
  - `http://localhost:3000/` — expect Topnav rendered, "Jobs" tab underlined, brand mark visible with gold `&`, sync-status text shows `LAST SYNC <relative>` (uppercased via CSS), refresh button clickable.
  - `http://localhost:3000/jobs/<any-id>` — "Jobs" tab still underlined.
  - `http://localhost:3000/settings` — "Settings" tab underlined.
  - `http://localhost:3000/pipeline` — page 404s (expected; JH-014 will create it). "Pipeline" tab is underlined on the 404 page.
- Click "sync" with backend running: dot animates `animate-pulse` while status is `running`, button label flips to `syncing`, button is disabled, then on completion the relative-time label updates to `today`.

### Open questions

1. **`animate-pulse` timing fidelity.** Tailwind's built-in is 2s @ opacity 1↔0.5. Prototype is 1.4s @ 1↔0.4. The ticket itself says "via Tailwind `animate-pulse` or a CSS keyframe — pick the simpler" and Non-goals forbid `globals.css` edits, so this plan uses `animate-pulse`. **Not a blocker.** Flagging in case the user reviews and wants the exact prototype timing — that would require either (a) extending `tailwind.config.ts` `keyframes`+`animation` (out of scope per Non-goals — needs a follow-up ticket) or (b) inline `style={{ animation: "..." }}` plus a `<style jsx>` block (also discouraged). Recommendation: ship with `animate-pulse`, defer to user feedback.
2. **Duplicate header on `/`.** `frontend/app/page.tsx` lines 195–229 render their own `<header>` with an `h1` "jobhunter" title and a Settings link. With this Topnav added globally, the home route will display two headers stacked vertically. This is **explicitly allowed by Non-goals** ("`app/page.tsx` … remain as-is … existing nav, if any, is replaced by the global Topnav from `layout.tsx`" — but the page.tsx header is page content, not nav, so it stays). JH-011 rebuilds the jobs list and removes this duplication. Flagging only so the verifier doesn't mistake it for a regression.
3. **Brand-mark casing & `&amp;`.** Confirmed lowercase `job&hunt` from `app.jsx` line 152: `job<span className="amp">&amp;</span>hunt`. The brand-tag text is lowercase in the JSX (`a field guide · vol. 04`) and rendered uppercase via CSS `text-transform`. Plan keeps lowercase source text + `uppercase` Tailwind utility — semantically correct and matches the prototype's render.
4. **`--font-sans` vs `--font-body`.** The prototype's `.btn` rule uses `var(--font-sans)`. The live `globals.css` defines both `--font-sans` (line 55) and `--font-body` (set by `next/font` via fonts.ts). Both resolve to Inter. The plan uses Tailwind's `font-display` / `font-mono` aliases (registered in `tailwind.config.ts`) and lets Tailwind inheritance handle the body sans (default body font already Inter via `body { font-family: var(--font-body) }`). No alias gap.
5. **`Tailwind ed-accent-30` and ring colors.** All `ed-*` aliases the Topnav needs (`ed-bg`, `ed-rule`, `ed-text`, `ed-muted`, `ed-accent`, `ed-surface`, `ed-surface-2`, `ed-border`, `ed-border-2`, `ed-red`, `ed-green`) exist in `tailwind.config.ts` post-JH-007. Confirmed — no missing aliases.

### Out-of-scope reminders (from Non-goals)

- Do not create `/pipeline` route — JH-014.
- Do not extract a shared `<Icon />` component — JH-010.
- Do not add a toast system — JH-010.
- Do not rebuild any page (`/`, `/jobs/[id]`, `/settings`) — JH-011/12/13.
- Do not remove the existing per-page sync UI in `app/page.tsx` — two sync indicators may temporarily coexist.
- Do not add new dependencies.
- Do not modify `backend/`, `app/api.ts`, `app/types.ts`, `globals.css`, `tailwind.config.ts`.

## Verification

**Verifier:** argos-verifier subagent
**Date:** 2026-04-26
**Status:** READY

### Acceptance criteria evidence

**1. `test -f frontend/app/components/topnav.tsx` exits 0** — PASS
```
$ test -f frontend/app/components/topnav.tsx && echo "TOPNAV_EXISTS"
TOPNAV_EXISTS
```

**2. `"use client"` directive present** — PASS
`frontend/app/components/topnav.tsx:1` reads `"use client";`.

**3. Default export named `Topnav`** — PASS
`frontend/app/components/topnav.tsx:28`:
```
export default function Topnav() {
```

**4. `usePathname` imported and used** — PASS
`frontend/app/components/topnav.tsx:4` imports `usePathname` from `next/navigation`; line 29 calls `const pathname = usePathname();`.

**5. `fetchSyncStatus` and `triggerSync` imported and used** — PASS
`frontend/app/components/topnav.tsx:6` — `import { fetchSyncStatus, triggerSync } from "../api";`. Used at lines 44, 55, 71, 72.

**6. Layout imports + renders Topnav** — PASS
`frontend/app/layout.tsx:3` — `import Topnav from "./components/topnav";`
`frontend/app/layout.tsx:21` — `<Topnav />` rendered above `{children}` inside `<body>`.

**7. `cd frontend && npx tsc --noEmit` exits 0 with no output** — PASS
```
$ cd frontend && npx tsc --noEmit && echo TSC_OK
TSC_OK
```

**8. `cd frontend && npm run build` reaches `Compiled successfully` and lint contains no `react-hooks/rules-of-hooks` errors** — PASS
```
> frontend@0.1.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/7) ...
 ✓ Generating static pages (7/7)
   Finalizing page optimization ...

Route (app)                              Size     First Load JS
┌ ○ /                                    4.1 kB          101 kB
├ ○ /_not-found                          873 B          88.2 kB
├ ○ /icon.svg                            0 B                0 B
├ ƒ /jobs/[id]                           37.8 kB         135 kB
└ ○ /settings                            2.82 kB        99.6 kB
```
No `react-hooks/rules-of-hooks` errors emitted; no errors referencing `app/components/topnav.tsx` or `app/layout.tsx`.

**9. `git diff --stat HEAD` lists only ticket-scoped files** — PASS
```
$ git status --porcelain
 M argos/specs/STATE.md
 M frontend/app/layout.tsx
?? argos/specs/tickets/JH-009-topnav-masthead.md
?? frontend/app/components/topnav.tsx
?? jobhunter/

$ git diff --stat HEAD
 argos/specs/STATE.md    | 2 +-
 frontend/app/layout.tsx | 2 ++
 2 files changed, 3 insertions(+), 1 deletion(-)
```
The `jobhunter/` untracked directory is the pre-existing design-handoff folder (`design_handoff_jobhunter_redesign`); not introduced by this ticket. No other source paths in diff.

**10. `git diff HEAD -- frontend/package.json frontend/package-lock.json` is empty** — PASS (empty output).

**11. No edits to `globals.css`, `tailwind.config.ts`, `api.ts`, `types.ts`, `backend/`, `README.md`, `argos/specs/ARCHITECTURE.md`, `argos/specs/PRD.md`** — PASS
All three diff commands produced empty output:
- `git diff -- frontend/app/page.tsx frontend/app/jobs/ frontend/app/settings/page.tsx frontend/app/components/job-card.tsx frontend/app/api.ts frontend/app/types.ts frontend/app/globals.css frontend/tailwind.config.ts` → empty
- `git diff -- backend/ README.md docker-compose.yml .env.example` → empty
- `git diff -- frontend/package.json frontend/package-lock.json` → empty

### Semantic checks (not just mechanical)

**Active-tab logic — handles `/`, `/jobs/[anything]`, `/pipeline`, `/settings`** — PASS
`frontend/app/components/topnav.tsx:92-94`:
```
const isJobs = pathname === "/" || pathname.startsWith("/jobs");
const isPipeline = pathname.startsWith("/pipeline");
const isSettings = pathname.startsWith("/settings");
```
- `/` → `isJobs = true` (matches `pathname === "/"`).
- `/jobs/abc-123` → `isJobs = true` (matches `startsWith("/jobs")`).
- `/pipeline` → `isPipeline = true`.
- `/settings` → `isSettings = true`.
All four cases covered. `Link` `aria-current="page"` is set on the active tab (lines 119, 122, 125).

**Brand mark — `job&hunt` with `&` in accent class** — PASS
`frontend/app/components/topnav.tsx:111`:
```
job<span className="text-ed-accent italic px-px">&amp;</span>hunt
```
The literal `job` + `&amp;` (rendered as `&`) + `hunt` JSX is wrapped in italic Fraunces (`font-display italic font-bold text-[26px]` on line 108). The `&` glyph carries `text-ed-accent` (the gold-post-token-swap accent). Brand-tag `a field guide · vol. 04` is on line 114 with `font-mono uppercase` styling and a `border-l border-ed-rule` hairline.

**Sync wiring — interval cleanup correct** — PASS
`pollRef = useRef<ReturnType<typeof setInterval> | null>(null)` (line 31). Cleanup mechanism is multi-layered:
1. `stopPoll` (lines 33-38) clears `pollRef.current` and nulls the ref. Memoized via `useCallback`.
2. `useEffect` cleanup (lines 62-65) sets `cancelled = true` and calls `stopPoll()` on unmount, ensuring no orphan interval.
3. Inside the interval callback (line 46), `if (s.status !== "running") stopPoll()` self-terminates polling once backend reports done.
4. The `if (pollRef.current) return;` guard in `startPoll` (line 41) prevents duplicate intervals if `onSync` runs while one is already active.

The `cancelled` flag in the mount effect (line 54, checked at 57) also prevents a stale `setStatus` after unmount — a subtle correctness check the planner specified and the coder implemented faithfully.

**Animate-pulse / no @keyframes in globals** — PASS
`frontend/app/components/topnav.tsx:138` — uses Tailwind built-in `animate-pulse` conditionally (`${running ? "animate-pulse" : ""}`). `grep` against `frontend/app/globals.css` for `@keyframes` returned no matches — globals.css was not touched (consistent with Non-goals).

### Tests result

No frontend test harness exists per ARCHITECTURE.md. Verification ran the documented Test Strategy:
- `npx tsc --noEmit` → exit 0.
- `npm run build` → `Compiled successfully`, no lint errors against new files.
- `git diff --stat HEAD` → only the two intended paths plus STATE/ticket bookkeeping.

### Regression scan

Searched callers of `fetchSyncStatus` / `triggerSync` to confirm no behavioural drift:
```
frontend/app/api.ts:22:export function triggerSync(): Promise<{ status: string }> {
frontend/app/api.ts:26:export function fetchSyncStatus(): Promise<SyncStatus> {
frontend/app/page.tsx:5:import { fetchJobs, fetchSyncStatus, getResumes, triggerSync } from "./api";
frontend/app/page.tsx:66:        fetchSyncStatus(),
frontend/app/page.tsx:89:      await triggerSync();
frontend/app/page.tsx:91:        const status = await fetchSyncStatus();
frontend/app/components/topnav.tsx:6:import { fetchSyncStatus, triggerSync } from "../api";
```
The existing `app/page.tsx` polling is untouched and still functions; Topnav adds its own independent poll. Two sync indicators will coexist on `/` until JH-011 — explicitly allowed by the Non-goals.

`Topnav` is referenced only by `frontend/app/layout.tsx` (the new import + render) — no stray callers.

Full production build (`npm run build`) completed with all 7 routes generating successfully — `/`, `/_not-found`, `/icon.svg`, `/jobs/[id]`, `/settings` all built. No regression in the existing routes.

### MANUAL_PENDING

The following manual smoke checks from the plan's Test Strategy require a running dev server and are MANUAL_PENDING (not auto-failed):
- `npm run dev` and visit `/` — verify Topnav renders, "Jobs" tab underlined, brand mark visible with gold `&`, `LAST SYNC <relative>` reads correctly, refresh button clickable.
- Visit `/jobs/<any-id>` — confirm "Jobs" still active.
- Visit `/settings` — confirm "Settings" active.
- Visit `/pipeline` — page 404s as expected (JH-014); "Pipeline" tab still underlined on the 404 page.
- Click `sync` with backend up — dot pulses, button disabled, label flips to `syncing`, then on completion `last sync today` appears.

These are visual checks not testable in CI without Playwright/Storybook (out of scope per ARCHITECTURE.md). User should run them before closing the cycle.

### Proposed STATE.md diff (parent loop applies)

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@ _One sentence. What is the single most important thing in flight right now? If y
 
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.
 
-- [JH-009](tickets/JH-009-topnav-masthead.md) — Topnav masthead component (P3)
+- _none_
 
 ## In progress
 
@@ -25,6 +25,7 @@ Tickets currently being executed by the loop or paused mid-cycle. At most one pe
 
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.
 
+- 2026-04-26 — [JH-009](tickets/JH-009-topnav-masthead.md) — Topnav masthead component (P3)
 - 2026-04-26 — [JH-008](tickets/JH-008-fix-rules-of-hooks-settings.md) — Fix rule-of-hooks violation in settings/page.tsx (P2)
 - 2026-04-26 — [JH-007](tickets/JH-007-design-tokens-and-fonts.md) — Design tokens + fonts foundation (P3)
 - 2026-04-26 — [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
@@ -43,4 +44,4 @@ Product or architecture calls that are pending and block one or more queued tick
 
 Places the code and `argos/specs/ARCHITECTURE.md` disagree. Each entry should name the file or module, one sentence on the mismatch, and a disposition (fix code, update docs, file ADR).
 
-- _none_
+- `frontend/app/page.tsx:195-229` renders a duplicate `<header>` (page-content title + Settings link) that now stacks below the global Topnav on `/`. **Transient phase state** — accepted during planning, will be removed when JH-011 rebuilds the jobs list against the editorial design. Disposition: fix code (in JH-011), no ADR needed.
```

**Last updated** is already `2026-04-26`; no header-line change required.

### Status: READY
