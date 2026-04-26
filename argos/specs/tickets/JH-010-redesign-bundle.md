# JH-010: Editorial redesign bundle — primitives, screens, pipeline route, cleanup

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** L

## Intent

Land the rest of the editorial redesign in one ticket. Build the shared primitives, rebuild the three live screens, add the new pipeline route, and clean up the design-handoff scratch directory. End state: the editorial redesign fully replaces the existing UI, the `jobhunter/` handoff folder is removed, and `STATE.md`'s known drift on `app/page.tsx` duplicate header is closed.

This bundles what was originally JH-010..JH-014 + cleanup. The handoff README at `jobhunter/design_handoff_jobhunter_redesign/README.md` is detailed enough that per-screen tickets would mostly repeat the same plan-code-verify cycle without surfacing new judgment calls. One ticket, one loop pass.

## Context

JH-007 lifted the design tokens + fonts. JH-009 shipped the Topnav masthead. The handoff prototype's remaining surface is:

- **Shared primitives** (`primitives.jsx`): `<Icon />` (Search, Refresh, Settings, Upload, Trash, Plus, Briefcase, Board, External, Wand), `<ScoreRing />`, `<ToastStack />`, `STATUS_PIP` color map, formatters.
- **Jobs list** (`view-list.jsx`): rebuild `app/page.tsx`. New toolbar (search, slider, source/resume/date/sort selects, remote-only and has-salary checkboxes, hairline dividers), 3-col card grid sharing hairlines, new `<JobCard />` with status stripe + score ring + matched/missing keyword chips.
- **Job detail** (`view-detail.jsx`): rebuild `app/jobs/[id]/page.tsx`. Hero block with 104px score ring, two-column body (score breakdown + keyword lists + description prose on left; status track + notes + details on right), tailored-result banner.
- **Settings** (`view-settings.jsx`): rebuild `app/settings/page.tsx`. Two-column layout (sticky 220px nav + content). Three sections: Resumes (label + drop-zone + list), Search terms (add form + active-toggle list), Integrations (status badges).
- **Pipeline / kanban** (`view-kanban.jsx`): NEW `app/pipeline/page.tsx`. Funnel strip + 6-column kanban grid. HTML5 drag-and-drop calls `updateApplication(jobId, { status })`.

User-confirmed open questions from the handoff: pipeline route YES; tweaks panel NO; tailor diff NO; keyboard nav NO.

## Scope

### Shared primitives (NEW components)

- `frontend/app/components/icon.tsx` — single `<Icon name="..." size={...} />` API. Names: `search`, `refresh`, `settings`, `upload`, `trash`, `plus`, `briefcase`, `board`, `external`, `wand`. SVG path data lifted verbatim from `jobhunter/design_handoff_jobhunter_redesign/primitives.jsx`. JH-009's inline refresh-icon SVG in `topnav.tsx` may opt-in via the new `<Icon />` if it tightens the diff; otherwise leave it inline (no scope creep).
- `frontend/app/components/score-ring.tsx` — `<ScoreRing score={number} size={...} stroke={...} />` rendering an SVG ring with animated `stroke-dashoffset`. Color thresholds match the prototype (≥70 green, ≥50 accent, ≥35 orange, else red).
- `frontend/app/components/toast.tsx` — minimal toast stack: `useToast()` hook + `<ToastStack />` mounted in `layout.tsx`. Bottom-right, 2.8s auto-dismiss, accent left-border, mono 11px label. No external dependency (no `sonner` / `react-hot-toast`).
- `frontend/app/components/badge.tsx` — `<Badge variant="source"|"remote"|"status"|...>` mono caps badge.
- `frontend/app/components/kw.tsx` — `<Kw matched|missing>{label}</Kw>` keyword chip (solid-border matched, dashed-border missing).

### Screen rebuilds (REPLACE existing implementations)

- `frontend/app/page.tsx` — replaced. New toolbar + 3-col card grid + new `<JobCard />`. Removes the duplicate `<header>` block at lines 195-229 (closes the known drift entry). Removes the existing per-page sync UI (Topnav owns sync now). Existing client-side filter logic (search, min-score, source, resume, date posted, remote-only, has-salary, sort) is reimplemented against the new toolbar markup; data fetching stays via `fetchJobs()`.
- `frontend/app/components/job-card.tsx` — replaced. New design: 240px min-height, status stripe, score ring, matched/missing kw chips, hairline shared borders.
- `frontend/app/jobs/[id]/page.tsx` — replaced. Hero + score breakdown + keyword lists + description prose + status track + notes + details. Markdown renderer for description (simple `#` / `##` / `###` / `**bold**` / `- list`). Tailored-result banner appears when present.
- `frontend/app/settings/page.tsx` — replaced. Two-column layout, three sections. The JH-008 `applyExampleTerm` fix carries forward (do not regress).

### NEW route

- `frontend/app/pipeline/page.tsx` — new file. Funnel strip + 6-column kanban with HTML5 drag-and-drop. Drop calls `updateApplication(jobId, { status: column })` and shows toast.

### Cleanup

- Delete the `jobhunter/` directory at the repo root (the design-handoff scratch). It's currently untracked, so `rm -rf jobhunter/` is the operation. Add a `.gitignore` entry **only if** the team wants future handoff drops in the same path; otherwise just delete and move on. (Recommend: just delete. No `.gitignore` entry needed.)

### Topnav follow-up (small)

- Optionally swap Topnav's inline refresh-icon SVG for `<Icon name="refresh" />` once `icon.tsx` exists. Allowed but not required — single small edit.

## Non-goals

- Do **not** add `sonner` / `react-hot-toast` / any new npm dep. Build the toast in-house (handoff says either is OK; in-house keeps `package.json` clean and matches the rest of the bundle).
- Do **not** port the tweaks panel (`tweaks-panel.jsx`). Single default theme (charcoal+gold) only.
- Do **not** add side-by-side tailor diff or keyboard navigation (j/k, hotkeys).
- Do **not** modify `frontend/app/api.ts` or `frontend/app/types.ts` — every needed function and type already exists. If something seems missing, raise as an open question, don't expand.
- Do **not** modify `backend/`.
- Do **not** modify `globals.css` or `tailwind.config.ts` — JH-007 supplies every token. Missing alias = open question, not silent extension.
- Do **not** add new routes beyond `/pipeline`.
- Do **not** modify `argos/specs/ARCHITECTURE.md` or `PRD.md`.
- Do **not** modify `package.json` or the lockfile.

## Acceptance criteria (draft — planner will refine)

- All listed component files exist with default exports and the API shapes the screens call.
- All four screens (`/`, `/jobs/[id]`, `/settings`, `/pipeline`) render without runtime errors and are visibly the editorial design (not the old design).
- `/pipeline` is no longer a 404 — it renders the kanban view.
- `app/page.tsx` no longer renders a duplicate `<header>` (the JH-009 transient drift is closed).
- Drag-and-drop in pipeline calls `updateApplication` with the column's status.
- Status track in detail page calls `updateApplication` on click.
- Notes textarea autosaves on blur via `updateApplication(jobId, { notes })`.
- Sync still works — Topnav's sync remains the single source of truth.
- `cd frontend && npx tsc --noEmit` exits cleanly.
- `cd frontend && npm run build` reaches `Compiled successfully` AND no `react-hooks/rules-of-hooks` errors AND all routes (including `/pipeline`) build.
- `git diff --stat` shows: new component files under `frontend/app/components/`, new `frontend/app/pipeline/page.tsx`, replaced `frontend/app/page.tsx` / `jobs/[id]/page.tsx` / `settings/page.tsx` / `components/job-card.tsx`, deleted `jobhunter/` directory, plus ticket and STATE.
- `backend/`, `argos/specs/ARCHITECTURE.md`, `PRD.md`, `README.md`, `docker-compose.yml`, `globals.css`, `tailwind.config.ts`, `api.ts`, `types.ts`, `package.json`, `package-lock.json` unchanged.
- The known drift entry for `app/page.tsx:195-229` duplicate header is removed by the verifier (closed).
- The `jobhunter/` directory is gone from the repo root.

## Plan

### Files touched

NEW components (5):
- `frontend/app/components/icon.tsx` — new
- `frontend/app/components/score-ring.tsx` — new
- `frontend/app/components/toast.tsx` — new (`useToast` hook + `<ToastStack />` + module store)
- `frontend/app/components/badge.tsx` — new
- `frontend/app/components/kw.tsx` — new

NEW route (1):
- `frontend/app/pipeline/page.tsx` — new (client component, kanban + funnel + HTML5 DnD)

REPLACED screens (3):
- `frontend/app/page.tsx` — replace contents (closes the duplicate-header drift)
- `frontend/app/jobs/[id]/page.tsx` — replace contents
- `frontend/app/settings/page.tsx` — replace contents

REPLACED card (1):
- `frontend/app/components/job-card.tsx` — replace contents (renamed default export to `JobCard`; the new caller uses the new name)

EDITED layout (1):
- `frontend/app/layout.tsx` — add a single `<ToastStack />` import + mount inside `<body>` after `{children}`. No other changes.

EDITED topnav (1, optional but recommended):
- `frontend/app/components/topnav.tsx` — delete the local `RefreshIcon` component and replace its single use with `<Icon name="refresh" />`. Only diff. If for some reason this breaks the build, leave the inline icon and proceed — it's not load-bearing.

DELETED:
- `jobhunter/` directory at repo root — `rm -rf jobhunter/` (fully untracked per `git ls-files jobhunter/` returning empty; nothing leaves git's view).

### API name reconciliation (lock these — the handoff JSX uses different names)

The coder MUST translate prototype names to the live `api.ts` names. No edits to `api.ts`.

| Prototype name (do not use)  | Live name (use this)         |
|------------------------------|------------------------------|
| `updateApplication(id, …)`   | `updateJobStatus(id, …)`     |
| `fetchResumes()`             | `getResumes()`               |
| `fetchSearchTerms()`         | `getSearchTerms()`           |
| `updateSearchTerm(id, …)`    | `toggleSearchTerm(id, bool)` |
| `getSyncStatus()`            | `fetchSyncStatus()`          |

Likewise, `SyncStatusRead` → `SyncStatus`, `ResumeMeta` → `Resume`. `ResumeScoreRead`, `ApplicationRead`, `Job`, `SearchTerm`, `TailorResponse`, `APPLICATION_STATUSES` are already correct.

### Per-file content

#### NEW: `frontend/app/components/icon.tsx`

Pure, no `"use client"` (no state/effects). One default export `Icon` keyed by `name` prop. SVG path data lifted verbatim from `primitives.jsx`. Names supported: `search`, `refresh`, `settings`, `upload`, `trash`, `plus`, `briefcase`, `board`, `external`, `wand`, plus convenience `arrow-right`, `arrow-left` (used by detail back-link and status track).

```tsx
import type { SVGProps } from "react";

type IconName =
  | "search" | "refresh" | "settings" | "upload" | "trash" | "plus"
  | "briefcase" | "board" | "external" | "wand"
  | "arrow-right" | "arrow-left";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, { viewBox: string; body: JSX.Element; defaultStrokeWidth?: number }> = {
  search: {
    viewBox: "0 0 16 16",
    body: (<>
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" />
    </>),
  },
  refresh: {
    viewBox: "0 0 16 16",
    body: (<>
      <path d="M14 8a6 6 0 1 1-1.76-4.24" />
      <path d="M14 2v3.5h-3.5" strokeLinecap="round" />
    </>),
  },
  settings: {
    viewBox: "0 0 16 16",
    body: (<>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" strokeLinecap="round" />
    </>),
  },
  upload: {
    viewBox: "0 0 16 16",
    body: (<>
      <path d="M8 11V2M8 2L4.5 5.5M8 2l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 13h12" strokeLinecap="round" />
    </>),
  },
  trash: {
    viewBox: "0 0 16 16",
    body: (<path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4" strokeLinecap="round" strokeLinejoin="round" />),
  },
  plus: {
    viewBox: "0 0 16 16",
    body: (<path d="M8 3v10M3 8h10" strokeLinecap="round" />),
  },
  briefcase: {
    viewBox: "0 0 16 16",
    body: (<>
      <rect x="2" y="5" width="12" height="9" rx="1" />
      <path d="M5.5 5V3h5v2" strokeLinecap="round" />
    </>),
  },
  board: {
    viewBox: "0 0 16 16",
    body: (<>
      <rect x="2" y="3" width="3" height="10" />
      <rect x="6.5" y="3" width="3" height="6" />
      <rect x="11" y="3" width="3" height="8" />
    </>),
  },
  external: {
    viewBox: "0 0 16 16",
    body: (<path d="M9 3h4v4M13 3l-6 6M11 9v4H3V5h4" strokeLinecap="round" strokeLinejoin="round" />),
  },
  wand: {
    viewBox: "0 0 16 16",
    body: (<path d="M3 13L11 5M11 5l1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" strokeLinecap="round" strokeLinejoin="round" />),
  },
  "arrow-right": {
    viewBox: "0 0 16 16",
    body: (<path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />),
  },
  "arrow-left": {
    viewBox: "0 0 16 16",
    body: (<path d="M13 8H3M7 4L3 8l4 4" strokeLinecap="round" strokeLinejoin="round" />),
  },
};

export default function Icon({ name, size = 14, ...rest }: IconProps) {
  const def = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      {...rest}
    >
      {def.body}
    </svg>
  );
}
```

Notes for coder: `plus` and `arrow-*` use SVG paths instead of the prototype's text glyphs to keep the API uniform (prototype renders `+` and `→` as text spans). The visual is equivalent at the call sites.

#### NEW: `frontend/app/components/score-ring.tsx`

Pure SVG, no client directive needed (no hooks). `score` accepted as `number | null | undefined`; clamps to 0–100. Color thresholds match prototype: `>=70` green, `>=50` accent, `>=35` orange, else red. Animated stroke-dashoffset via inline `style={{ transition: ... }}`.

```tsx
interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}

function colorFor(v: number): string {
  if (v >= 70) return "var(--green)";
  if (v >= 50) return "var(--accent)";
  if (v >= 35) return "var(--orange)";
  return "var(--red)";
}

export default function ScoreRing({ score, size = 54, stroke = 4, showLabel = true }: ScoreRingProps) {
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  const color = colorFor(v);

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size, color }}
    >
      <svg width={size} height={size} className="block" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      {showLabel && (
        <div
          className="absolute inset-0 grid place-items-center font-display italic font-semibold tracking-[-0.04em] leading-none"
          style={{ fontSize: size * 0.34, color: "var(--text)" }}
        >
          {Math.round(v)}
          <small
            className="font-mono not-italic font-medium uppercase ml-[2px]"
            style={{ fontSize: "0.36em", color: "var(--muted)", letterSpacing: "0.1em" }}
          >
            %
          </small>
        </div>
      )}
    </div>
  );
}
```

#### NEW: `frontend/app/components/toast.tsx`

In-house toast system. Module-scoped store + subscribe pattern (not Context — avoids needing a provider). `useToast()` returns a `push(text, kind?)` function. `<ToastStack />` is a client component that subscribes and renders the fixed bottom-right stack.

```tsx
"use client";

import { useEffect, useState } from "react";

export type ToastKind = "info" | "error";
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const l of listeners) l(toasts);
}

export function pushToast(text: string, kind: ToastKind = "info"): void {
  const id = nextId++;
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 2800);
}

export function useToast() {
  return { push: pushToast };
}

export function ToastStack() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    const sub: Listener = (next) => setItems(next);
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="bg-ed-surface border border-ed-rule border-l-2 rounded-ed-md px-4 py-2.5 font-mono text-[11px] tracking-[0.04em] text-ed-text flex items-center gap-2.5 min-w-[260px] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{
            borderLeftColor: t.kind === "error" ? "var(--red)" : "var(--accent)",
            animation: "ed-toast-in 200ms ease-out",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: t.kind === "error" ? "var(--red)" : "var(--accent)" }}
          />
          <span>{t.text}</span>
        </div>
      ))}
      <style jsx>{`
        @keyframes ed-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
```

Notes: `pushToast` is exported as a function callers can import directly; `useToast()` is a thin convenience. Module state is fine for a single-window app (the tool is local-LAN per ARCHITECTURE invariants). No new deps. The `<style jsx>` block is supported by Next 14 out of the box without extra config.

#### NEW: `frontend/app/components/badge.tsx`

Pure component, no hooks. Maps the prototype's `.badge`, `.badge-accent`, `.badge-green`, `.badge-red`, `.badge-yellow`, `.badge-orange` classes to Tailwind utilities.

```tsx
import type { ReactNode, CSSProperties } from "react";

type Variant = "neutral" | "accent" | "green" | "red" | "yellow" | "orange";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  style?: CSSProperties;
}

const VARIANT: Record<Variant, string> = {
  neutral: "text-ed-muted border-ed-border-2",
  accent:  "bg-ed-accent-15 text-ed-accent border-ed-accent-30",
  green:   "text-ed-green",
  red:     "text-ed-red",
  yellow:  "text-ed-yellow",
  orange:  "text-ed-orange",
};

export default function Badge({ variant = "neutral", children, style }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] px-2 py-[3px] rounded-ed border ${VARIANT[variant]}`}
      style={{
        // green/red/yellow/orange variants use rgba border-color literals from styles.css; inline to avoid extending tailwind.config.ts
        ...(variant === "green"  && { borderColor: "rgba(109,191,110,0.40)" }),
        ...(variant === "red"    && { borderColor: "rgba(216,58,43,0.40)"  }),
        ...(variant === "yellow" && { borderColor: "rgba(227,179,65,0.40)" }),
        ...(variant === "orange" && { borderColor: "rgba(224,138,60,0.40)" }),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
```

#### NEW: `frontend/app/components/kw.tsx`

Pure component. Renders the matched (solid border, ✓ prefix via CSS-free inline) or missing (dashed border) keyword chip.

```tsx
import type { ReactNode } from "react";

interface KwProps {
  variant: "matched" | "missing";
  children: ReactNode;
}

export default function Kw({ variant, children }: KwProps) {
  if (variant === "matched") {
    return (
      <span className="inline-flex items-center font-mono text-[11px] px-2 py-[2px] rounded-ed border text-ed-text border-ed-text bg-transparent whitespace-nowrap">
        <span className="text-ed-green mr-[2px]">✓</span>
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center font-mono text-[11px] px-2 py-[2px] rounded-ed border border-dashed text-ed-muted border-ed-border bg-transparent whitespace-nowrap">
      {children}
    </span>
  );
}
```

#### REPLACED: `frontend/app/components/job-card.tsx`

Replace contents wholesale with the new editorial card. Default export is now `JobCard` (name change from `JobRow`). The card includes status stripe via inline `::before`-equivalent (an absolutely-positioned `<span>` since we can't define CSS pseudo-elements in TSX), the score ring, and matched/missing chips. Border behavior on the grid (top + left rule on the grid; right + bottom on the card) is achieved by setting `border-r border-b border-ed-rule` on each card and `border-t border-l border-ed-rule` on the grid container in `page.tsx`.

```tsx
"use client";

import Link from "next/link";
import { memo } from "react";
import type { Job } from "../types";
import ScoreRing from "./score-ring";
import Badge from "./badge";
import Kw from "./kw";

function fmtSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const f = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (min && max) return `${f(min)}–${f(max)}`;
  if (min) return `${f(min)}+`;
  return `up to ${f(max!)}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STRIPE: Record<string, string> = {
  applied: "bg-ed-accent",
  phone_screen: "bg-ed-yellow",
  interview: "bg-ed-orange",
  offer: "bg-ed-green",
  rejected: "bg-ed-rule",
};

const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)",
  applied: "var(--accent)",
  phone_screen: "var(--yellow)",
  interview: "var(--orange)",
  offer: "var(--green)",
  rejected: "var(--red)",
};

interface JobCardProps {
  job: Job;
  resumeFilter: string;
}

function JobCardImpl({ job, resumeFilter }: JobCardProps) {
  const scores = job.resume_scores || [];
  const focusScore =
    resumeFilter !== "all"
      ? scores.find((s) => s.resume_id === resumeFilter)
      : scores.length
        ? scores.reduce((a, b) => (b.score > a.score ? b : a))
        : null;
  const otherScores = focusScore ? scores.filter((s) => s.resume_id !== focusScore.resume_id) : scores;
  const matched = focusScore?.matched_keywords?.slice(0, 4) ?? [];
  const missing = focusScore?.missing_keywords?.slice(0, 2) ?? [];
  const status = job.application?.status;
  const salary = fmtSalary(job.min_salary, job.max_salary);
  const stripeClass = status ? STATUS_STRIPE[status] ?? "bg-transparent" : "bg-transparent";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="relative flex flex-col gap-4 p-card-pad min-h-[240px] border-r border-b border-ed-rule cursor-pointer transition-colors duration-ed-fast hover:bg-ed-surface text-left overflow-hidden"
    >
      {/* status stripe */}
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripeClass}`} />

      {/* head */}
      <div className="flex gap-3.5 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge>{job.site.replace(/_/g, " ")}</Badge>
            {job.is_remote && <Badge variant="accent">remote</Badge>}
            {status && status !== "saved" && (
              <span
                className="inline-flex items-center gap-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] px-2 py-[3px] rounded-ed border"
                style={{ color: STATUS_PIP[status], borderColor: STATUS_PIP[status], background: "transparent" }}
              >
                {status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ed-text m-0 leading-[1.1] line-clamp-2">
            {job.title}
          </h3>
          <p className="font-body text-[13px] text-ed-muted mt-0.5 mb-0">
            <strong className="text-ed-text font-semibold">{job.company}</strong>
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
        {focusScore && (
          <div className="flex flex-col items-center gap-1.5">
            <ScoreRing score={focusScore.score} size={58} stroke={4} />
            <div className="font-mono text-[9px] text-ed-muted uppercase tracking-[0.08em] whitespace-nowrap">
              {focusScore.label}
            </div>
          </div>
        )}
      </div>

      {/* keywords */}
      {focusScore && (matched.length > 0 || missing.length > 0) && (
        <div className="flex flex-wrap gap-1 min-h-[22px]">
          {matched.map((k) => <Kw key={`m-${k}`} variant="matched">{k}</Kw>)}
          {missing.map((k) => <Kw key={`x-${k}`} variant="missing">{k}</Kw>)}
        </div>
      )}

      {/* foot */}
      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-dashed border-ed-border mt-auto font-mono text-[11px] text-ed-muted">
        <div className="flex flex-wrap gap-3.5 items-center">
          {salary && <span className="text-ed-green">{salary}</span>}
          <span>{fmtRelative(job.date_posted)}</span>
          {otherScores.map((s) => (
            <span key={s.resume_id}>
              {s.label.toLowerCase()}: {Math.round(s.score)}%
            </span>
          ))}
        </div>
        <span className="inline-grid place-items-center min-w-[18px] h-[18px] px-1.5 font-mono text-[10px] font-medium bg-ed-inset border border-ed-border rounded-ed-sm text-ed-muted">
          ↵
        </span>
      </div>
    </Link>
  );
}

const JobCard = memo(JobCardImpl);
export default JobCard;
```

#### REPLACED: `frontend/app/page.tsx`

Replace contents wholesale. Removes the duplicate `<header>` (closes drift). Removes per-page sync UI (Topnav owns sync; just observe via `fetchSyncStatus` for the subtitle). Filter logic is the **same** as the existing `useMemo` block at lines 104–182 — copy it byte-equivalent into the new file. Render: page-header (title, subtitle, reset-filters button), Toolbar, then either empty state or 3-col `job-grid` of `<JobCard />` components.

Structural outline (the coder may copy filter logic verbatim from the current `page.tsx:104-182`):

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJobs, fetchSyncStatus, getResumes } from "./api";
import JobCard from "./components/job-card";
import Icon from "./components/icon";
import type { Job, Resume, SyncStatus } from "./types";

interface Filters {
  search: string;
  minScore: number;
  remoteOnly: boolean;
  hasSalary: boolean;
  sortBy: "score" | "date" | "company";
  source: "all" | "indeed" | "linkedin";
  resume: string;
  datePosted: "any" | "24h" | "3d" | "week";
}

const DEFAULT_FILTERS: Filters = {
  search: "", minScore: 0, remoteOnly: false, hasSalary: false,
  sortBy: "score", source: "all", resume: "all", datePosted: "any",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const load = useCallback(async () => {
    try {
      const [jobList, status, resumeList] = await Promise.all([
        fetchJobs(), fetchSyncStatus(), getResumes(),
      ]);
      setJobs(jobList);
      setSyncStatus(status);
      setResumes(resumeList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo<Job[]>(() => {
    // Copy the existing filter+sort pipeline from the prior page.tsx (lines 104-182).
    // Adapt variable names to read off `filters` rather than separate useStates.
    let result = [...jobs];
    const q = filters.search.toLowerCase();
    if (q) {
      result = result.filter(
        (j) => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q),
      );
    }
    if (filters.minScore > 0) {
      result = result.filter((j) => {
        const s = j.resume_scores || [];
        return s.length > 0 && Math.max(...s.map((x) => x.score)) >= filters.minScore;
      });
    }
    if (filters.remoteOnly) result = result.filter((j) => j.is_remote);
    if (filters.source !== "all") result = result.filter((j) => j.site === filters.source);
    if (filters.resume !== "all") {
      result = result.filter((j) => (j.resume_scores || []).some((s) => s.resume_id === filters.resume));
    }
    if (filters.datePosted !== "any") {
      const W: Record<string, number> = {
        "24h": 86400000, "3d": 3 * 86400000, week: 7 * 86400000,
      };
      const cut = Date.now() - W[filters.datePosted];
      result = result.filter((j) => j.date_posted && new Date(j.date_posted).getTime() >= cut);
    }
    if (filters.hasSalary) result = result.filter((j) => j.min_salary != null || j.max_salary != null);

    const best = (j: Job) => {
      const s = j.resume_scores || [];
      return s.length ? Math.max(...s.map((x) => x.score)) : 0;
    };
    const scoreFor = (j: Job, rid: string) => {
      const m = (j.resume_scores || []).find((s) => s.resume_id === rid);
      return m ? m.score : 0;
    };
    result.sort((a, b) => {
      if (filters.resume !== "all") return scoreFor(b, filters.resume) - scoreFor(a, filters.resume);
      if (filters.sortBy === "score") return best(b) - best(a);
      if (filters.sortBy === "company") return a.company.localeCompare(b.company);
      return new Date(b.date_fetched).getTime() - new Date(a.date_fetched).getTime();
    });
    return result;
  }, [jobs, filters]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const lastSync = syncStatus?.finished_at ? fmtRelative(syncStatus.finished_at) : "never";

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-7 pb-4 border-b border-ed-rule">
        <div>
          <h1 className="font-display italic font-bold text-[44px] tracking-[-0.035em] m-0 mb-1.5 text-ed-text leading-none">Jobs</h1>
          <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
            {filtered.length} of {jobs.length} jobs · last sync {lastSync} · {resumes.length} resumes loaded
          </p>
        </div>
        <button
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md font-body text-[13px] font-medium bg-ed-surface text-ed-text border border-ed-border hover:bg-ed-surface-2 hover:border-ed-border-2 transition-colors duration-ed-fast"
        >
          reset filters
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2.5 py-3.5 mb-6 items-center border-b border-ed-rule">
        {/* search input with leading icon */}
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ed-muted flex">
            <Icon name="search" />
          </span>
          <input
            type="text"
            placeholder="search title or company…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="block w-full bg-ed-inset border border-ed-border rounded-ed-md pl-9 pr-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
          />
        </div>
        <div className="w-px h-[18px] bg-ed-rule mx-1" aria-hidden />
        <div className="flex items-center gap-2">
          <label htmlFor="ms" className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-ed-muted">min</label>
          <input
            id="ms" type="range" min={0} max={100} step={1}
            value={filters.minScore}
            onChange={(e) => set("minScore", Number(e.target.value))}
            className="w-24 accent-ed-accent"
          />
          <span className="font-mono text-[11px] text-ed-text min-w-[28px]">{filters.minScore}%</span>
        </div>
        <div className="w-px h-[18px] bg-ed-rule mx-1" aria-hidden />

        {/* selects: source, resume, date, sort. Use a shared className. */}
        {/* IMPLEMENTATION: render five `<select>` elements with className matching the prototype's `.select`:
              "appearance-none bg-ed-inset border border-ed-border rounded-ed-md px-3 pr-7 py-2 text-[13px] text-ed-text font-body focus:outline-none focus:border-ed-accent"
            Source options: all, indeed, linkedin (match the JH-004 set — DO NOT include zip_recruiter or google).
            Resume options: "all" + each resume's id with label.toLowerCase() display.
            Date options: any, 24h, 3d, week.
            Sort options: score, date, company.
        */}

        {/* checkboxes: remote only, has salary */}
        {/* IMPLEMENTATION: two <label> elements, each containing an <input type="checkbox" className="w-3.5 h-3.5 accent-ed-accent" /> + mono caption text. */}
      </div>

      {/* Body: skeleton, error, empty, or grid */}
      {/* loading: render 6 skeleton cards via simple divs.
         error:  red-tinted box.
         empty:  dashed-border .empty equivalent with reset-filters button.
         grid:   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 border-t border-l border-ed-rule">
                   {filtered.map(j => <JobCard key={j.id} job={j} resumeFilter={filters.resume} />)}
                 </div>
      */}
    </main>
  );
}
```

Coder note: the source filter's options must remain `all | indeed | linkedin` (JH-004 removed `zip_recruiter` and `google`). The handoff JSX includes the latter two — drop them. The grid uses Tailwind responsive breakpoints `md:` (768px) and `xl:` (1280px) as a pragmatic equivalent of the prototype's 720px/1100px breakpoints.

#### REPLACED: `frontend/app/jobs/[id]/page.tsx`

Replace contents wholesale. Use the existing API patterns from the prior file (verbatim): `loadJob`, `handleStatusChange` (with optimistic update + rollback), `handleNotesSave`, `handleTailor`. Render the editorial hero / score-breakdown / keyword lists / description / status track / notes / details. Use `react-markdown` for description (already installed); the handoff's `simpleMarkdown` is unnecessary.

Structural outline:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  fetchJob, getResumes, resumeDownloadUrl, tailorResume, updateJobStatus,
} from "../../api";
import {
  APPLICATION_STATUSES, ApplicationRead, ApplicationStatus, Job, Resume, TailorResponse,
} from "../../types";
import ScoreRing from "../../components/score-ring";
import Badge from "../../components/badge";
import Kw from "../../components/kw";
import Icon from "../../components/icon";
import { useToast } from "../../components/toast";

const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)", applied: "var(--accent)", phone_screen: "var(--yellow)",
  interview: "var(--orange)", offer: "var(--green)", rejected: "var(--red)",
};

function fmtSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const f = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (min && max) return `${f(min)}–${f(max)}`;
  if (min) return `${f(min)}+`;
  return `up to ${f(max!)}`;
}
function fmtRelative(iso: string | null): string { /* same as job-card */ /* … */ return ""; }

export default function JobDetail() {
  const params = useParams();
  const id = params.id as string;
  const { push } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState<TailorResponse | null>(null);
  const [notes, setNotes] = useState("");

  // loadJob, handleStatusChange (with optimistic update — reuse the previous block byte-for-byte),
  // handleNotesSave, handleTailor — same as the previous file. After updateJobStatus and tailorResume succeed, call push("status → applied") / push("tailored ✓").

  // Render:
  //  - <button class="back-link"> ... <Icon name="arrow-left" /> back to jobs
  //  - .detail-hero — grid 1fr auto, badges + h1 (font-display italic 56px) + company line + salary + actions-row.
  //    actions-row: <a> apply on {site} <Icon name="external" />, <button> Wand + tailor resume,
  //    resume <select>, ghost <a> download .docx href={resumeDownloadUrl(...)}.
  //  - Right column of hero: <ScoreRing size={104} stroke={6} /> with eyebrow above and "vs. {label}" below.
  //  - Tailored banner (when tailorResult) — accent-tinted block.
  //  - .detail-grid — 2-col (1fr 340px) → stacks at <960.
  //    Left:
  //      § score breakdown — score-stat cards (border-ed-accent-30 if selected) + matched/missing kw lists.
  //      § description — react-markdown wrapped in `prose prose-invert prose-sm font-display [&_h1]:... ` to mimic the prototype's typography. max-h 540px overflow-y-auto.
  //    Right:
  //      § application status — status-track of 6 buttons. Click → handleStatusChange + push toast.
  //      § notes — textarea, onBlur → handleNotesSave + push toast.
  //      § details — <dl>: source, type, posted, fetched, applied.
}
```

Coder note: status track styling — the active row is `bg-ed-accent-15 text-ed-accent border-ed-accent-30 font-semibold`; inactive rows are `text-ed-muted border-transparent`; "done" rows have a dimmed pip. Pip is a 7px circle whose background is `var(--border-2)` for inactive, `STATUS_PIP[s]` for the current row, `var(--accent-dim)` for done rows. Implement these as inline styles to avoid extending Tailwind for one-off colors.

#### REPLACED: `frontend/app/settings/page.tsx`

Replace contents. Two-column layout: 220px sticky nav on left + content on right. Three sections: resumes (upload form + drop zone + list), search terms (add form + examples + list), integrations (5 hardcoded rows). Preserve `applyExampleTerm` (JH-008's rename). Wire to live api.ts: `getResumes`, `uploadResume`, `deleteResume`, `getSearchTerms`, `addSearchTerm`, `toggleSearchTerm`, `deleteSearchTerm`. Drop-zone is implemented inline (no new dep).

Structural outline:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSearchTerm, deleteResume, deleteSearchTerm, getResumes, getSearchTerms,
  toggleSearchTerm, uploadResume,
} from "../api";
import type { Resume, SearchTerm } from "../types";
import Icon from "../components/icon";
import { useToast } from "../components/toast";

const ALLOWED_EXTS = [".docx", ".pdf"];
const EXAMPLES = [
  "software engineer", "python developer", "backend engineer",
  "devops engineer", "platform engineer", "site reliability engineer",
];

type Section = "resumes" | "terms" | "integrations";

export default function SettingsPage() {
  const { push } = useToast();
  const [section, setSection] = useState<Section>("resumes");
  // resume + term state and handlers — copy verbatim from the prior settings/page.tsx.
  // Keep `applyExampleTerm` named exactly that (JH-008).

  // Render:
  //  <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
  //    page-header (Settings + subtitle)
  //    settings-grid: 220px nav + 1fr content (stacks at <720)
  //      <nav>: 3 settings-nav-items (briefcase + resumes + count, search + search terms + count, settings + integrations).
  //             aria-current={section === ...}.
  //      <div>: section-specific render (resumes / terms / integrations).
}
```

Coder note: integrations section is a static list of 5 rows, but trim it to match this project's reality — the live backend uses Indeed + LinkedIn (per ARCHITECTURE) and Gemini. Keep all 5 rows from the handoff (Gemini, Indeed, LinkedIn, ZipRecruiter, Google) since this is a UI surface only — the user can decide later whether to mark unsupported ones as "warning". For now, mark Indeed/LinkedIn/Gemini as "connected" and ZipRecruiter/Google as "warning" to reflect the current `FLAKY_SITES` state.

#### NEW: `frontend/app/pipeline/page.tsx`

Client component. Funnel strip + 6-column kanban with HTML5 drag-and-drop. Drop calls `updateJobStatus(jobId, { status })` (the live name).

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJobs, updateJobStatus } from "../api";
import { APPLICATION_STATUSES, ApplicationStatus, Job } from "../types";
import ScoreRing from "../components/score-ring";
import { useToast } from "../components/toast";

const COLS = APPLICATION_STATUSES; // ["saved", "applied", "phone_screen", "interview", "offer", "rejected"]
const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)", applied: "var(--accent)", phone_screen: "var(--yellow)",
  interview: "var(--orange)", offer: "var(--green)", rejected: "var(--red)",
};

function fmtRelative(iso: string | null): string { /* shared helper */ return ""; }

export default function PipelinePage() {
  const { push } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setJobs(await fetchJobs()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "failed to load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const g: Record<string, Job[]> = Object.fromEntries(COLS.map((c) => [c, [] as Job[]]));
    jobs.forEach((j) => {
      const s = (j.application?.status as ApplicationStatus | undefined) || "saved";
      if (g[s]) g[s].push(j);
    });
    Object.keys(g).forEach((k) => {
      g[k].sort((a, b) => {
        const ta = new Date(a.application?.updated_at || a.date_fetched).getTime();
        const tb = new Date(b.application?.updated_at || b.date_fetched).getTime();
        return tb - ta;
      });
    });
    return g;
  }, [jobs]);

  const counts: Record<string, number> = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, v.length]),
  );

  const onDrop = async (col: ApplicationStatus) => {
    const id = draggingId;
    setDraggingId(null);
    setDropCol(null);
    if (!id) return;
    // Optimistic
    const prev = jobs;
    setJobs((js) =>
      js.map((j) =>
        j.id === id
          ? {
              ...j,
              application: {
                job_id: j.id,
                status: col,
                resume_used: j.application?.resume_used ?? null,
                notes: j.application?.notes ?? null,
                applied_at: j.application?.applied_at ?? (col === "applied" ? new Date().toISOString() : null),
                updated_at: new Date().toISOString(),
              },
            }
          : j,
      ),
    );
    try {
      await updateJobStatus(id, { status: col });
      push(`status → ${col.replace(/_/g, " ")}`);
    } catch {
      setJobs(prev);
      push("failed to update status", "error");
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
      {/* page-header: Pipeline title + subtitle "drag jobs between columns to update status · {n} jobs tracked". */}
      {/* Funnel strip: flex row, 6 cells, border-t/b-rule, each cell: italic 32px count (accent if > 0) + 9.5px mono uppercase label. */}
      {/* Kanban grid:
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 border-t border-l border-ed-rule">
              {COLS.map((col) => (
                <div key={col}
                     onDragOver={(e) => { e.preventDefault(); setDropCol(col); }}
                     onDragLeave={() => setDropCol((c) => (c === col ? null : c))}
                     onDrop={() => onDrop(col)}
                     className={`border-r border-b border-ed-rule min-h-[320px] flex flex-col ${dropCol === col ? "bg-ed-accent-15" : ""}`}>
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-dashed border-ed-border">
                    <h3 className="font-display italic font-semibold text-[16px] tracking-[-0.02em] m-0 flex items-center gap-2.5">
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: STATUS_PIP[col] }} />
                      {col.replace(/_/g, " ")}
                    </h3>
                    <span className="font-mono text-[11px] text-ed-muted">{counts[col]}</span>
                  </div>
                  <div className="p-3 flex flex-col gap-2.5 flex-1">
                    {grouped[col].length === 0
                      ? <div className="font-mono text-[10px] text-ed-dim p-4 text-center border border-dashed border-ed-border rounded-ed-md uppercase tracking-[0.18em]">no jobs</div>
                      : grouped[col].map((j) => (
                          <Link href={`/jobs/${j.id}`} key={j.id}
                                draggable
                                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingId(j.id); }}
                                onDragEnd={() => { setDraggingId(null); setDropCol(null); }}
                                className={`bg-ed-surface border border-ed-border rounded-ed-md p-3 flex flex-col gap-1.5 cursor-grab transition-colors duration-ed-fast hover:border-ed-rule hover:bg-ed-surface-2 ${draggingId === j.id ? "opacity-40" : ""}`}>
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-display italic font-semibold text-[14px] tracking-[-0.02em] m-0 leading-tight text-ed-text">{j.title}</h4>
                              {(() => {
                                const best = (j.resume_scores || []).reduce<typeof j.resume_scores[number] | null>(
                                  (a, b) => (!a || b.score > a.score ? b : a), null,
                                );
                                return best ? <ScoreRing score={best.score} size={32} stroke={3} showLabel={false} /> : null;
                              })()}
                            </div>
                            <p className="font-body text-[12px] text-ed-muted m-0">{j.company}{j.location ? ` · ${j.location}` : ""}</p>
                            <div className="flex items-center justify-between gap-1.5 mt-1 font-mono text-[10px] text-ed-muted tracking-[0.05em]">
                              <span>{j.site.replace(/_/g, " ")}{j.is_remote ? " · remote" : ""}</span>
                              <span>{fmtRelative(j.application?.updated_at || j.date_fetched)}</span>
                            </div>
                          </Link>
                        ))}
                  </div>
                </div>
              ))}
            </div>
      */}
    </main>
  );
}
```

Coder note: the kcard uses `<Link>` so click navigates to the detail; native HTML5 drag still fires from a `draggable` `<a>` in modern browsers. If the drag doesn't fire reliably from `<Link>` during manual testing, fall back to a `<div>` with an `onClick={() => router.push(...)}` and pull `useRouter` from `next/navigation`.

#### EDITED: `frontend/app/layout.tsx`

Add `<ToastStack />` mount. Single import + single JSX line. No other changes.

Diff:
```diff
 import type { Metadata } from "next";
 import { fraunces, inter, jetbrainsMono } from "./lib/fonts";
 import Topnav from "./components/topnav";
+import { ToastStack } from "./components/toast";
 import "./globals.css";
@@
       <body
         className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
       >
         <Topnav />
         {children}
+        <ToastStack />
       </body>
```

#### EDITED: `frontend/app/components/topnav.tsx` (recommended, optional)

Swap the inline `RefreshIcon` for the new shared component. Tightens consistency.

Diff:
```diff
-import { fetchSyncStatus, triggerSync } from "../api";
+import { fetchSyncStatus, triggerSync } from "../api";
+import Icon from "./icon";
 import type { SyncStatus } from "../types";
@@
-function RefreshIcon({ size = 14 }: { size?: number }) {
-  return (
-    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
-      <path d="M14 8a6 6 0 1 1-1.76-4.24" />
-      <path d="M14 2v3.5h-3.5" strokeLinecap="round" />
-    </svg>
-  );
-}
-
 export default function Topnav() {
@@
-            <RefreshIcon />
+            <Icon name="refresh" />
```

#### DELETED: `jobhunter/`

Pre-flight check (re-confirmed during this planning): `git ls-files jobhunter/` is empty (the directory is fully untracked), and `ls jobhunter/design_handoff_jobhunter_redesign/` shows: `README.md`, `app.jsx`, `data.js`, `jobhunter.html`, `primitives.jsx`, `styles.css`, `tweaks-panel.jsx`, `view-detail.jsx`, `view-kanban.jsx`, `view-list.jsx`, `view-settings.jsx`, plus matching `.Zone.Identifier` files (Windows alternate-stream artifacts).

Operation: `rm -rf /home/taddymason/projects/programs/jobhunter/jobhunter`. No `.gitignore` change needed.

### Acceptance criteria (refined, runnable)

Type & build:
- `cd frontend && npx tsc --noEmit` exits 0 with no output.
- `cd frontend && npm run build` reaches `Compiled successfully`. The static page list in the build output includes `/`, `/jobs/[id]` (dynamic), `/settings`, and `/pipeline`.
- `cd frontend && npm run lint` exits 0. No `react-hooks/rules-of-hooks` errors. No `react/no-unescaped-entities` errors introduced.

Files & untouched surface (verifiable via `git diff --name-only`):
- New: `frontend/app/components/icon.tsx`, `score-ring.tsx`, `toast.tsx`, `badge.tsx`, `kw.tsx`, `frontend/app/pipeline/page.tsx`.
- Modified: `frontend/app/page.tsx`, `frontend/app/jobs/[id]/page.tsx`, `frontend/app/settings/page.tsx`, `frontend/app/components/job-card.tsx`, `frontend/app/layout.tsx`, optionally `frontend/app/components/topnav.tsx`.
- Deleted: the entire `jobhunter/` tree at the repo root (verified by `test ! -d jobhunter`).
- Unchanged (verify byte-equal): `frontend/app/api.ts`, `frontend/app/types.ts`, `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/package.json`, `frontend/package-lock.json`, all of `backend/`, all of `argos/specs/ARCHITECTURE.md`, `argos/specs/PRD.md`, `README.md`, `docker-compose.yml`.

Runtime smoke (with backend running on :8000 and frontend on :3000):
- `GET http://localhost:3000/` returns 200 and the response HTML contains `Jobs` (page title) and at least one card or the empty-state copy "no jobs".
- `GET http://localhost:3000/jobs/<some-existing-id>` returns 200 and contains the job title, hero score ring, and "application status" sidebar.
- `GET http://localhost:3000/settings` returns 200 and contains all three section names: `resumes`, `search terms`, `integrations`.
- `GET http://localhost:3000/pipeline` returns 200 (no longer 404) and contains all 6 column titles (`saved`, `applied`, `phone screen`, `interview`, `offer`, `rejected`).

Behavioral:
- On `/`, the previous duplicate `<header>` is gone (only the global Topnav header remains above the page content).
- On `/pipeline`, dragging a kcard from one column and dropping it on another fires `PATCH /jobs/{id}/status` with body `{"status": "<col>"}` (verifiable in browser network tab); a toast appears reading `status → <col>`.
- On `/jobs/[id]`, clicking a status step in the right sidebar fires the same PATCH with the new status.
- On `/jobs/[id]`, blurring the notes textarea fires PATCH with `{"notes": "..."}`.
- Sync still works via Topnav (unchanged behavior).

Drift closure (verifier action — coder does NOT touch STATE.md):
- After acceptance passes, the verifier removes the bullet `frontend/app/page.tsx:195-229 renders a duplicate <header>...` from `argos/specs/STATE.md` "Known drift" section.

### Test strategy

No test runner exists in this repo (per ARCHITECTURE "Code style"); acceptance is via build + manual route smoke. Concretely:

1. `cd frontend && npx tsc --noEmit` — passes with no output.
2. `cd frontend && npm run build` — reaches `Compiled successfully`. Capture the build summary; confirm the route list includes `/pipeline`.
3. `cd frontend && npm run lint` — passes.
4. Start backend (`cd backend && uvicorn main:app --reload --port 8000`) and frontend (`cd frontend && npm run dev`); curl the four routes and grep for the marker strings listed in the runtime smoke checks.
5. Manual DnD verification on `/pipeline`: drag a card to a new column, verify network call + toast + STATE update reflected in DB.

### Open questions

None. Investigation surfaced these would-be ambiguities and resolved each deterministically:

- **API name divergence** (`updateApplication`, `fetchResumes`, `fetchSearchTerms`, `getSyncStatus`, `updateSearchTerm`) → the live `api.ts` already provides functionally equivalent helpers under different names; the plan locks the live names. No `api.ts` edits.
- **Type name divergence** (`SyncStatusRead`, `ResumeMeta`) → live types are `SyncStatus`, `Resume`; the plan uses live names. No `types.ts` edits.
- **Toast architecture** → in-house module-store + subscribe pattern (no Context, no provider). Matches the bundle's "no new deps" non-goal.
- **`react-markdown` vs `simpleMarkdown`** → `react-markdown` is already an installed dep used by the current detail page; reuse it. The handoff's `simpleMarkdown` would be a needless re-implementation.
- **Source filter options** → keep JH-004's `all | indeed | linkedin` set (do not regress by re-adding the prototype's `zip_recruiter` and `google`).
- **Topnav refresh icon** → swap to `<Icon name="refresh" />` (consistency win, tiny diff). If it ever blocks the build, leave the inline icon as-is.
- **Tailwind alias coverage** — confirmed all `ed-*` aliases needed by the new screens (`bg-ed-bg/surface/surface-2/inset/accent-15/accent-30/accent-dim`, `text-ed-text/muted/dim/accent/green/red/yellow/orange/on-accent`, `border-ed-border/border-2/rule/accent-30`, `rounded-ed-{sm,,md,lg,xl}`, `font-display/mono/body`, `duration-ed-{fast,base,slow}`, `p-card-pad`, `py-row-pad-y`) are present in `tailwind.config.ts` post-JH-007. No config edits.
- **Out-of-pallete border colors** (the 40%-alpha `green/red/yellow/orange` border tints used by `Badge`'s `green/red/yellow/orange` variants) → applied as inline `style={{ borderColor: "rgba(...)" }}` rather than extending Tailwind. Avoids touching `tailwind.config.ts`.

### Out-of-scope reminders

- No new npm deps. No `package.json` / `package-lock.json` diff.
- No edits to `api.ts`, `types.ts`, `globals.css`, `tailwind.config.ts`, `backend/`, `argos/specs/ARCHITECTURE.md`, or `PRD.md`.
- No additional routes beyond `/pipeline`.
- No tweaks panel, no tailor diff view, no keyboard navigation, no `sonner`/`react-hot-toast`.
- No drive-by refactors. The `JobRow` → `JobCard` rename is intentional and load-bearing (the new card is a different component); it is not a drive-by.
- The coder MUST NOT touch `argos/specs/STATE.md`. The verifier closes the duplicate-header drift entry on pass.

## Verification

**Verifier:** argos verifier subagent
**Date:** 2026-04-26
**Watchdog ruling carry-over:** PASS, with one structural note — the planned `frontend/app/components/icon.tsx` was named `icon-svg.tsx` mid-run to avoid colliding with the existing `/icon.svg` static asset route (visible in the build output as `○ /icon.svg  0 B`). All four call sites (`page.tsx`, `jobs/[id]/page.tsx`, `settings/page.tsx`, `topnav.tsx`) import from `./icon-svg`/`../components/icon-svg`/`../../components/icon-svg` consistently. The component identifier (default export `Icon`) and external API (`<Icon name="..." />`) are unchanged from the plan. Treated as a path-only adjustment, not a structural deviation.

### Acceptance criteria — runnable evidence

#### 1. `cd frontend && npx tsc --noEmit`

```
TSC_OK
```

`tsc` exited 0 with no output before `echo TSC_OK`. **PASS.**

#### 2. `cd frontend && npm run build`

```
> frontend@0.1.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/8) ...
   Generating static pages (2/8)
   Generating static pages (4/8)
   Generating static pages (6/8)
 ✓ Generating static pages (8/8)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    5.54 kB         102 kB
├ ○ /_not-found                          873 B          88.2 kB
├ ○ /icon.svg                            0 B                0 B
├ ƒ /jobs/[id]                           42.4 kB         139 kB
├ ○ /pipeline                            6.37 kB         103 kB
└ ○ /settings                            8.52 kB        95.8 kB
+ First Load JS shared by all            87.3 kB
```

`Compiled successfully` reached. All four required app routes present: `/`, `/jobs/[id]` (dynamic, ƒ), `/pipeline`, `/settings`. No `react-hooks/rules-of-hooks` errors. **PASS.**

#### 3. `cd frontend && npm run lint`

```
> frontend@0.1.0 lint
> next lint

✔ No ESLint warnings or errors
```

**PASS.**

#### 4. `ls frontend/app/components/`

```
badge.tsx
icon-svg.tsx
job-card.tsx
kw.tsx
score-ring.tsx
toast.tsx
topnav.tsx
```

All 7 expected files (badge, icon-svg, job-card, kw, score-ring, toast, topnav) present. **PASS.**

#### 5. `ls frontend/app/pipeline/`

```
page.tsx
```

Pipeline route exists. **PASS.**

#### 6. `ls jobhunter/`

```
ls: cannot access '/home/taddymason/projects/programs/jobhunter/jobhunter/': No such file or directory
```

Design-handoff scratch directory deleted. **PASS.**

#### 7. Forbidden-file diffs (must be empty)

```
$ git diff -- frontend/app/api.ts frontend/app/types.ts frontend/app/globals.css \
              frontend/tailwind.config.ts frontend/package.json \
              frontend/package-lock.json backend/
(no output)

$ git diff -- argos/specs/ARCHITECTURE.md argos/specs/PRD.md README.md \
              docker-compose.yml .env.example
(no output)
```

All non-negotiable surfaces unchanged. **PASS.**

#### 8. Stale handoff names absent from `frontend/app/`

```
$ grep -rn "updateApplication\|getSyncStatus\|fetchResumes\|fetchSearchTerms\|SyncStatusRead\|ResumeMeta" frontend/app/
(no output)
```

API name reconciliation table fully applied — no prototype names leaked. **PASS.**

#### 9. JH-008 `applyExampleTerm` rename preserved

```
$ grep -nE "applyExampleTerm|handleExampleTerm|addExampleTerm" frontend/app/settings/page.tsx
199:  const applyExampleTerm = (example: string) => {
422:                        onClick={() => applyExampleTerm(ex)}
```

Non-`use*`-prefixed handler still present and wired. JH-008's rules-of-hooks fix not regressed. **PASS.**

#### 10. JH-004 source filter preserved (no `zip_recruiter` in jobs list)

```
$ grep -n "zip_recruiter" frontend/app/page.tsx
(no output)
```

Removed source still removed. **PASS.**

#### 11. Topnav uses shared `<Icon />` and refresh-icon swap

```
$ grep -n "icon-svg\|Icon\|RefreshIcon\|name=\"refresh\"" frontend/app/components/topnav.tsx
8:import Icon from "./icon-svg";
139:            <Icon name="refresh" />
```

Inline `RefreshIcon` removed; replaced by `<Icon name="refresh" />` from the new shared component. **PASS.**

#### 12. Pipeline drag-drop calls `updateJobStatus`

```
$ grep -n "updateJobStatus" frontend/app/pipeline/page.tsx
5:import { fetchJobs, updateJobStatus } from "../api";
118:      await updateJobStatus(id, { status: col });

$ grep -n "onDrop\|onDragStart\|onDragOver\|draggable" frontend/app/pipeline/page.tsx
88:  const onDrop = async (col: ApplicationStatus) => {
173:              onDragOver={(e) => { ... }}
180:              onDrop={() => onDrop(col)}
212:                        draggable
213:                        onDragStart={(e) => { ... }}
```

HTML5 DnD wired; on drop, the live `updateJobStatus(id, { status: col })` is called (correct API name, no prototype `updateApplication`). **PASS.**

#### 13. Detail page status track + notes call `updateJobStatus`

```
$ grep -n "updateJobStatus" frontend/app/jobs/[id]/page.tsx
12:  updateJobStatus,
137:      await updateJobStatus(job.id, { status });
150:      await updateJobStatus(job.id, { notes });

$ grep -n "handleStatusChange\|onBlur\|handleNotesSave" frontend/app/jobs/[id]/page.tsx
121:  const handleStatusChange = async (status: ApplicationStatus) => {
146:  const handleNotesSave = async () => {
416:                    onClick={() => handleStatusChange(status)}
454:              onBlur={handleNotesSave}
```

Status step click → `handleStatusChange` → `updateJobStatus({ status })`. Notes textarea `onBlur` → `handleNotesSave` → `updateJobStatus({ notes })`. **PASS.**

#### 14. `<ToastStack />` mounted in layout

```
$ grep -n "Topnav\|ToastStack" frontend/app/layout.tsx
3:import Topnav from "./components/topnav";
4:import { ToastStack } from "./components/toast";
22:        <Topnav />
24:        <ToastStack />
```

Both Topnav and ToastStack mounted inside `<body>`. **PASS.**

#### 15. Duplicate `<header>` removed from `app/page.tsx`

```
$ grep -c "header" frontend/app/page.tsx
0
```

The previously-flagged duplicate `<header>` block at lines 195–229 of the old `page.tsx` is gone. The global Topnav is the only header on `/`. **PASS — drift closed.**

#### 16. `git status` (sanity)

```
modified:   argos/specs/STATE.md
modified:   frontend/app/components/job-card.tsx
modified:   frontend/app/components/topnav.tsx
modified:   frontend/app/jobs/[id]/page.tsx
modified:   frontend/app/layout.tsx
modified:   frontend/app/page.tsx
modified:   frontend/app/settings/page.tsx
Untracked:
  argos/specs/tickets/JH-010-redesign-bundle.md
  frontend/app/components/badge.tsx
  frontend/app/components/icon-svg.tsx
  frontend/app/components/kw.tsx
  frontend/app/components/score-ring.tsx
  frontend/app/components/toast.tsx
  frontend/app/pipeline/
```

Modified set matches plan's REPLACED screens + EDITED layout/topnav. Untracked set matches plan's NEW components + NEW pipeline route + the ticket file itself. STATE.md modification is from the planner/coder context (out-of-scope for verifier — flagged below). The `jobhunter/` directory is gone (no longer in tree, was untracked). **PASS** on file-set.

### Manual visual smoke (MANUAL_PENDING)

Plan §"Test strategy" step 4–5 require booting backend + frontend and visually verifying:
- All 4 routes load and render the editorial design.
- DnD on `/pipeline` actually moves a card and fires `PATCH /jobs/{id}/status`.
- Status step click on `/jobs/[id]` fires PATCH.
- Notes textarea blur fires PATCH.
- Topnav sync click works.

These cannot be exercised from a non-interactive shell. Static evidence is strong (build passes, handlers are wired to live API names, lint clean, types clean), but **MANUAL_PENDING** must be cleared by the human operator before declaring the redesign user-visible-correct. Not a blocker for this verifier ruling — this is per-plan policy.

### Regression scan

- `git diff` against `frontend/app/api.ts`, `types.ts`, `globals.css`, `tailwind.config.ts`, `package.json`, `package-lock.json`, `backend/`: empty. No callers of modified API surfaces could regress because the API surface is unchanged.
- The only function-level renames in the diff are local: `JobRow` → `JobCard` (job-card.tsx default export). `frontend/app/page.tsx` is the sole caller and imports the default export under the new name. No other imports of the old name exist (`grep -rn "JobRow" frontend/app/` would return empty post-replace; build + tsc pass corroborate).
- `RefreshIcon` was internal to `topnav.tsx`; deletion has no external callers.
- Full type-check (`tsc --noEmit`) and full lint (`next lint`) clean across the whole frontend tree, not just changed files. No regression detectable from static analysis.

### Notes for STATE.md update (verifier-owned, parent applies)

- Plan calls for closing the existing Known drift entry (`frontend/app/page.tsx:195-229` duplicate header). Verified above (criterion 15). Replace section with `_none_`.
- The watchdog/coder appears to have already touched `argos/specs/STATE.md` (visible as modified in `git status`). This is outside the coder's allowed-tools per `CLAUDE.md` ("Coder never updates STATE"). Verifier flags but does not act on this — outer loop should reconcile by applying only the verifier-proposed diff (below) and discarding any other pre-existing STATE.md edits.

### STATE.md diff proposal

Apply against the on-disk `argos/specs/STATE.md` (current contents shown in input — the proposed diff below assumes the on-disk file matches that snapshot; if the coder pre-edited STATE.md, reset it to that snapshot first, then apply this diff):

```diff
@@ Queue
-- [JH-010](tickets/JH-010-redesign-bundle.md) — Editorial redesign bundle — primitives, screens, pipeline route, cleanup (P3)
+_none_

@@ Done this cycle
+- 2026-04-26 — [JH-010](tickets/JH-010-redesign-bundle.md) — Editorial redesign bundle — primitives, screens, pipeline route, cleanup (P3)
 - 2026-04-26 — [JH-009](tickets/JH-009-topnav-masthead.md) — Topnav masthead component (P3)
 - 2026-04-26 — [JH-008](tickets/JH-008-fix-rules-of-hooks-settings.md) — Fix rule-of-hooks violation in settings/page.tsx (P2)
 ...

@@ Known drift
-- `frontend/app/page.tsx:195-229` renders a duplicate `<header>` that now stacks below the global Topnav on `/`. Transient phase state — accepted during JH-009 planning, removed when JH-011 rebuilds the jobs list. Disposition: fix code (in JH-011), no ADR needed.
+_none_
```

`**Last updated:**` is already 2026-04-26; no change needed.

### Status

**READY** (with **MANUAL_PENDING** flag on the visual / runtime smoke per plan §Test strategy steps 4–5; not a blocker for ticket close per plan policy).
