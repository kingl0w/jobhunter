# JH-007: Design tokens + fonts foundation

**Status:** Queued
**Created:** 2026-04-26
**Priority:** P3
**Estimated effort:** M

## Intent

Lift the editorial-redesign design tokens (colors, typography scale, spacing, radii, motion) from the handoff prototype's `styles.css` into the live frontend's `globals.css` + `tailwind.config.ts`, and load the three required Google Fonts (Fraunces, Inter, Geist Mono) via `next/font/google` in `app/layout.tsx`. This is foundation work for the redesign phase (JH-008..JH-013) — no UI changes are visible after this ticket lands; it just makes the tokens and fonts *available* for the screens that follow.

## Context

The redesign handoff at `jobhunter/design_handoff_jobhunter_redesign/` is a clickable HTML/JSX prototype, not production code. Its design tokens live under `:root` and `[data-bg=...]` / `[data-accent=...]` selectors in `styles.css` (~1000 lines total, but only the `:root`/theme block is in scope for this ticket — the component classes get reimplemented per-screen in later tickets via Tailwind utilities).

**Default theme to ship:** the user-approved screenshots use `[data-bg="charcoal"] + [data-accent="gold"]` (handoff README lines 122-128). That is the default to lift into the live site. Other theme variants from `styles.css` (e.g., other bg/accent combos) are out of scope — single default theme only.

**Fonts:** Fraunces (display serif, ital + opsz axes, weights 400-900), Inter (body sans), Geist Mono (mono) — all from Google Fonts via `next/font/google`. The handoff specifies axis usage and `font-variant-numeric: tabular-nums oldstyle-nums` on body.

The current `frontend/tailwind.config.ts` already references CSS custom properties (`var(--color-bg)`, `var(--font-display)`, etc.) — so this work is additive: extend / replace the existing `:root` block in `globals.css` with the redesign tokens, and align Tailwind's theme keys.

This ticket is the foundation for:
- JH-008 (Topnav masthead component)
- JH-009 (shared primitives — ScoreRing, Badge, Kw chip, Icon, toast)
- JH-010..JH-012 (rebuild jobs list, detail, settings screens)
- JH-013 (NEW pipeline / kanban route)

## Scope

- **Edit `frontend/app/globals.css`:** replace or extend the `:root` block with the redesign's color tokens (charcoal bg, gold accent, semantic colors, text/muted/dim, surface tiers, border/rule), typography family vars, type-scale custom properties, spacing/radii/motion vars, and the body grain + selection styles.
- **Edit `frontend/tailwind.config.ts`:** ensure all token keys referenced by upcoming components have a Tailwind alias (colors, fontFamily, borderColor, spacing extensions if needed for `--card-pad`, `--radius-*`). Keep the existing `var(--...)`-based pattern.
- **Edit `frontend/app/layout.tsx`:** add `next/font/google` imports for `Fraunces`, `Inter`, and `Geist_Mono`. Wire each font's CSS variable (e.g., `--font-display`, `--font-body`, `--font-mono`) onto `<html>` or `<body>`. Set `font-variant-numeric: tabular-nums oldstyle-nums` on body. Preserve any existing layout shell behavior.
- **Editorial details to preserve from the prototype:** subtle paper grain on body (radial-gradient dots, low opacity), `::selection` in accent, axis settings on Fraunces (ital + opsz). All declared in `globals.css`, not as components.

## Non-goals

- Do **not** port the tweaks panel (`tweaks-panel.jsx`) — explicitly out per user's open-question answer. Single default theme only.
- Do **not** port any other theme variants beyond charcoal+gold default.
- Do **not** rebuild any screen yet (`page.tsx`, `jobs/[id]/page.tsx`, `settings/page.tsx`) — those are JH-010..JH-012.
- Do **not** add the new `/pipeline` route — that's JH-013.
- Do **not** replace `app/components/job-card.tsx` yet — JH-010 handles the new card design.
- Do **not** add toast / sonner / react-hot-toast — that's part of JH-009 (shared primitives).
- Do **not** modify `backend/`, `app/api.ts`, `app/types.ts`, or any data layer.
- Do **not** delete the `jobhunter/` handoff dir from the repo root — that's a separate cleanup decision.
- Do **not** add new dependencies beyond what `next/font/google` already supports (Fraunces / Inter / Geist_Mono are all available there — no new package installs).

## Acceptance criteria (draft — planner will refine)

- After the edit, the existing site at `npm run dev` still renders without runtime errors. Existing screens (jobs list, detail, settings) remain functional — they may look slightly different where they happened to inherit from a token that changed (e.g., body background color), but no broken layout, no console errors, no missing fonts.
- Fraunces, Inter, and Geist Mono are loaded via `next/font/google` in `app/layout.tsx` — verifiable by reading the file and confirming the imports + variable wiring.
- `globals.css` contains the redesign's full charcoal+gold token set (color vars, type-family vars, type-scale vars, spacing/radii/motion vars, paper-grain body bg, accent `::selection`).
- `tailwind.config.ts` exposes every token key the later tickets will need (no missing aliases — verify by spot-checking against the handoff README's "Design Tokens" section).
- `cd frontend && npx tsc --noEmit` exits cleanly.
- `cd frontend && npm run build` succeeds (or `npm run dev` starts cleanly with no compile errors — pick one as the gate).
- `git diff --stat` shows ONLY frontend files modified (`globals.css`, `tailwind.config.ts`, `layout.tsx`, plus possibly a new `frontend/app/lib/fonts.ts` if the planner decides to extract font loading) plus the ticket and STATE.
- `backend/`, `argos/specs/`, `README.md`, and `docker-compose.yml` unchanged.
- No `package.json` or lockfile changes.

## Plan

### Strategy decision

**Coexist, do not replace.** The existing `globals.css` defines tokens as `--color-bg`, `--color-surface`, etc.; the redesign prototype's tokens are `--bg`, `--surface`, etc. There is no CSS-variable name collision, so both sets can live in the same `:root` block. This ticket adds the new prototype tokens alongside the existing `--color-*` block. The existing Tailwind aliases (`bg`, `surface`, `surface-raised`, `accent`, `accent-subtle`, `primary`, `secondary`, `muted`, `strong`, `subtle`) keep resolving to the old `--color-*` values, so no existing component shifts. New Tailwind aliases (prefixed `ed-`) are added that resolve to the new prototype vars; later rebuild tickets (JH-010..JH-013) opt into them per-component. A follow-up cleanup ticket after Phase 2 removes the old `--color-*` block once no component references its aliases.

Justification: the alternative (replace) would shift the body background from `#1c1c20` (cool slate) to `#16140f` (warm charcoal) and the accent from `#7c9cff` (cornflower blue) to `#c79a3e` (gold) — both are visible, hue-changing shifts that would propagate to every existing component immediately. The ticket bar is "no UI changes visible after this ticket lands"; coexist meets that bar strictly with no inheritance risk on backgrounds, borders, or accent surfaces.

**One exception**: fonts. The existing `--font-display` is wired to Space_Grotesk; the redesign needs Fraunces in the same variable name. Replacing Space_Grotesk with Fraunces will visually shift every existing `font-display` usage (h1/h2 page titles, the brand mark, section labels). The ticket explicitly accepts this class of inheritance shift. We replace, because:
1. Forward-looking — every Phase 2 screen rebuild expects Fraunces under `--font-display`.
2. Adding a *separate* `--font-display-editorial` variable would require the rebuild tickets to thread a different className through every heading and would defer the shift to a different ticket without changing its end state.
3. Inter is already wired to `--font-body` so that variable name is unchanged.

### Font loading constraint discovered

`next/font/google` (Next 14.2.35) does **not** export `Geist_Mono`. Verified by reading `frontend/node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts` (line 6265 has `JetBrains_Mono`, no `Geist_*` export anywhere). The handoff README's mono stack already lists JetBrains Mono as the second fallback (`"Geist Mono", "JetBrains Mono", ui-monospace, Menlo, monospace`), so JetBrains_Mono is the substitute the prototype itself was prepared for. Plan loads `JetBrains_Mono` and writes the CSS variable `--font-mono` with the prototype's full font-family stack including the `"Geist Mono"` literal at the head, so if a future Next upgrade adds Geist_Mono we can swap loaders without touching consumers.

### Files touched

| File | Action |
|---|---|
| `frontend/app/globals.css` | edit |
| `frontend/tailwind.config.ts` | edit |
| `frontend/app/layout.tsx` | edit |
| `frontend/app/lib/fonts.ts` | new |

No `package.json` change. No new dependency.

### Changes per file

#### `frontend/app/lib/fonts.ts` (new)

Extract the three `next/font/google` loaders into one module so `layout.tsx` stays readable.

- Export `fraunces` from `Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"], axes: ["opsz", "SOFT", "WONK"], weight: "variable" })`. Variable axes pulled per the handoff README spec (opsz 9–144, SOFT 0–100, WONK 0–1).
- Export `inter` from `Inter({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: "variable" })`.
- Export `jetbrainsMono` from `JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: "variable" })`. Substitute for Geist_Mono (unavailable in Next 14.2.35 — see Font loading constraint above). The CSS-side font-family stack in `globals.css` lists `"Geist Mono"` first as a literal so the look matches if a user has it installed.

#### `frontend/app/layout.tsx` (edit)

- Remove the inline `Space_Grotesk` and `Inter` imports (lines 2, 5–15).
- Add `import { fraunces, inter, jetbrainsMono } from "./lib/fonts";`.
- Replace the body className `${spaceGrotesk.variable} ${inter.variable} antialiased` with `${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`.
- Leave `<html lang="en">` unchanged. Do not add `data-bg` / `data-accent` attributes — single default theme, no tweaks panel.
- Leave `metadata` unchanged.

#### `frontend/app/globals.css` (edit)

Append a new `:root` block after the existing `:root` block (line 16). Do not touch the existing `--color-*` declarations; do not touch the existing `body`, `::selection`, or scrollbar rules.

New content to add to `:root` (charcoal+gold default, lifted verbatim from the prototype's `:root` lines 9–62 with `[data-bg="charcoal"]` (lines 70–73) and `[data-accent="gold"]` (line 90) overrides applied):

```css
:root {
  /* editorial redesign tokens — JH-007. Coexist with --color-* until Phase 2 cleanup. */
  --bg:           #16140f;
  --bg-tile:      transparent;
  --surface:      #1f1c16;
  --surface-2:    #28241c;
  --inset:        #14110b;
  --border:       #34302a;
  --border-2:     #4a4438;
  --rule:         #6b6555;

  --text:         #f4ecdb;
  --muted:        #b9ad94;
  --dim:          #847a64;

  --accent:       #c79a3e;
  --accent-dim:   #9a7528;
  --accent-glow:  #e6b85b;
  --accent-15:    rgba(199, 154, 62, 0.13);
  --accent-30:    rgba(199, 154, 62, 0.32);
  --on-accent:    #1a140a;

  --green:        #6dbf6e;
  --red:          #d83a2b;
  --yellow:       #e3b341;
  --orange:       #e08a3c;
  --tint-green:   rgba(109, 191, 110, 0.12);
  --tint-red:     rgba(216, 58, 43, 0.12);
  --tint-yellow:  rgba(227, 179, 65, 0.12);
  --tint-orange:  rgba(224, 138, 60, 0.12);

  --hairline:        1px solid var(--border);
  --hairline-rule:   1px solid var(--rule);
  --hairline-accent: 1px solid var(--accent-30);

  --font-serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-mono-stack:  "Geist Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
  --font-sans:  "Inter", ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 2px;
  --radius:    3px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 10px;

  --dur-fast: 120ms;
  --dur-base: 180ms;
  --dur-slow: 280ms;

  --row-pad-y: 14px;
  --card-pad:  22px;
}
```

Note: `--font-mono-stack` is a new name (not `--font-mono`) so it does not collide with the `--font-mono` variable that `next/font/google`'s JetBrains_Mono loader writes via the `variable: "--font-mono"` option. The Tailwind alias `font-mono` (added below) reads from the loader's `--font-mono` and falls back to the stack for unstyled cases. If the coder finds this dual-name arrangement confusing they may instead inline the stack into the `fontFamily.mono` Tailwind alias and drop `--font-mono-stack` entirely — open question logged below.

Append after the existing `body { ... }` block (lines 23–27):

```css
body {
  font-variant-numeric: tabular-nums oldstyle-nums;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
    radial-gradient(rgba(255, 255, 255, 0.008) 1px, transparent 1px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
}
```

Two separate `body { ... }` blocks (additive) is fine — CSS merges them. The existing block sets `color`, `background` (solid), and `font-family`; the new block adds the variant-numeric and stacks paper-grain `background-image` on top of the existing solid `background`. The existing `background: var(--color-bg)` solid color shows through the grain at default opacity (the grain is white at 0.8–1.2% alpha — invisible against `#1c1c20`).

Do **not** add an `[data-bg="paper"]` paper-grain override (out of scope — single charcoal default).

Do **not** modify the existing `::selection` rule on lines 33–36 — it currently uses `var(--color-accent)`, which keeps it on-brand for existing screens. Phase 2 will rewrite components to use the new accent and at that point the `::selection` rule should switch to `var(--accent)` / `var(--on-accent)`. Out of scope for this ticket per "no UI changes visible".

#### `frontend/tailwind.config.ts` (edit)

Add new aliases under `theme.extend`. Do **not** remove any existing alias.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // existing — DO NOT REMOVE until Phase 2 cleanup
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        accent: "var(--color-accent)",
        "accent-subtle": "var(--color-accent-subtle)",
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        muted: "var(--color-text-muted)",
        // editorial redesign — JH-007
        "ed-bg": "var(--bg)",
        "ed-surface": "var(--surface)",
        "ed-surface-2": "var(--surface-2)",
        "ed-inset": "var(--inset)",
        "ed-text": "var(--text)",
        "ed-muted": "var(--muted)",
        "ed-dim": "var(--dim)",
        "ed-accent": "var(--accent)",
        "ed-accent-dim": "var(--accent-dim)",
        "ed-accent-glow": "var(--accent-glow)",
        "ed-accent-15": "var(--accent-15)",
        "ed-accent-30": "var(--accent-30)",
        "ed-on-accent": "var(--on-accent)",
        "ed-green": "var(--green)",
        "ed-red": "var(--red)",
        "ed-yellow": "var(--yellow)",
        "ed-orange": "var(--orange)",
        "ed-tint-green": "var(--tint-green)",
        "ed-tint-red": "var(--tint-red)",
        "ed-tint-yellow": "var(--tint-yellow)",
        "ed-tint-orange": "var(--tint-orange)",
      },
      borderColor: {
        // existing
        strong: "var(--color-border)",
        subtle: "var(--color-border-subtle)",
        // editorial redesign — JH-007
        "ed-border": "var(--border)",
        "ed-border-2": "var(--border-2)",
        "ed-rule": "var(--rule)",
        "ed-accent-30": "var(--accent-30)",
      },
      fontFamily: {
        // unchanged variable names; --font-display now resolves to Fraunces, --font-body still Inter
        display: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        // new — JH-007
        mono: ["var(--font-mono)", "Geist Mono", "JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        "ed-sm": "var(--radius-sm)",
        ed: "var(--radius)",
        "ed-md": "var(--radius-md)",
        "ed-lg": "var(--radius-lg)",
        "ed-xl": "var(--radius-xl)",
      },
      spacing: {
        "card-pad": "var(--card-pad)",
        "row-pad-y": "var(--row-pad-y)",
      },
      transitionDuration: {
        "ed-fast": "var(--dur-fast)",
        "ed-base": "var(--dur-base)",
        "ed-slow": "var(--dur-slow)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

Note the `display` and `body` font-family fallbacks change from `system-ui, sans-serif` (current) to the prototype's stacks (`"Iowan Old Style", Georgia, serif` for display and `ui-sans-serif, system-ui, sans-serif` for body). This is consistent with the swap of the underlying loader (Space_Grotesk → Fraunces).

### Acceptance criteria

Each line is a runnable command + a pass condition. Run from repo root unless noted.

1. **TypeScript clean.**
   - Cmd: `cd frontend && npx tsc --noEmit`
   - Pass: exit code 0, no diagnostics.

2. **Production build succeeds.**
   - Cmd: `cd frontend && npm run build`
   - Pass: exit code 0; output contains `✓ Compiled successfully`. The build is the gate (not `dev`) because `next build` validates the font loader at fetch time and surfaces the Geist_Mono / JetBrains_Mono swap if it regresses.

3. **New token names exist.**
   - Cmd: `grep -cE '^\s*--bg:\s*#16140f' frontend/app/globals.css`
   - Pass: ≥ 1.
   - Cmd: `grep -cE '^\s*--accent:\s*#c79a3e' frontend/app/globals.css`
   - Pass: ≥ 1.
   - Cmd: `grep -cE '^\s*--text:\s*#f4ecdb' frontend/app/globals.css`
   - Pass: ≥ 1.

4. **Old token names still resolve.**
   - Cmd: `grep -cE '^\s*--color-bg:' frontend/app/globals.css`
   - Pass: ≥ 1.
   - Cmd: `grep -cE 'var\(--color-bg\)' frontend/tailwind.config.ts`
   - Pass: ≥ 1 (the existing `bg: "var(--color-bg)"` Tailwind alias still maps).
   - Cmd: `grep -cE '^\s*(primary|secondary|muted|accent|surface|surface-raised|bg):\s*"var\(--color-' frontend/tailwind.config.ts`
   - Pass: ≥ 7 (all seven existing color aliases still present).

5. **Font wiring.**
   - Cmd: `grep -cE 'Fraunces|JetBrains_Mono' frontend/app/lib/fonts.ts`
   - Pass: 2 (both loaders imported).
   - Cmd: `grep -cE 'Space_Grotesk' frontend/app/layout.tsx`
   - Pass: 0 (old loader removed).
   - Cmd: `grep -cE 'fraunces\.variable.*inter\.variable.*jetbrainsMono\.variable|fraunces\.variable.*jetbrainsMono\.variable.*inter\.variable' frontend/app/layout.tsx`
   - Pass: ≥ 1 (all three CSS-variable classes attached to `<body>`).

6. **Body details preserved.**
   - Cmd: `grep -cE 'tabular-nums oldstyle-nums' frontend/app/globals.css`
   - Pass: ≥ 1.
   - Cmd: `grep -cE 'radial-gradient' frontend/app/globals.css`
   - Pass: ≥ 2 (two stacked dot patterns).

7. **Visual smoke (manual gate, not scriptable).**
   - Cmd: `cd frontend && npm run dev` then load `http://localhost:3000/`, `http://localhost:3000/jobs/<any-id>` (use any id present in the local DB; if no jobs exist, the empty state is acceptable), `http://localhost:3000/settings`.
   - Pass: each route renders with no console errors and no missing-font warnings (Network tab shows the three Google Fonts CSS files load 200). The pages may look slightly different from before (heading typeface shifts from Space_Grotesk to Fraunces); body backgrounds, borders, and accent colors should look unchanged versus pre-ticket because they still bind to `--color-*`. This is a manual check — flag it as such in the verification report.

8. **Diff scope.**
   - Cmd: `git diff --stat`
   - Pass: only these paths appear: `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/app/layout.tsx`, `frontend/app/lib/fonts.ts` (new), `argos/specs/tickets/JH-007-design-tokens-and-fonts.md`, `argos/specs/STATE.md`.
   - Pass: zero entries under `backend/`, `README.md`, `docker-compose.yml`, or any other path.

9. **No package changes.**
   - Cmd: `git diff --name-only -- frontend/package.json frontend/package-lock.json`
   - Pass: empty output.

### Test strategy

No unit-test harness exists in the frontend (per ARCHITECTURE.md "Tests" subsection — confirmed: no `frontend/tests/`, no test runner in `package.json`). Verification is the build + grep checks above plus a manual visual smoke. Out of scope for this ticket: adding a test runner. If the verifier wants a regression net, the `npm run build` gate exercises Tailwind compilation of every alias against every component class — a missing alias surfaces as an "Cannot apply unknown utility class" error and fails the build.

No new test files to add.

### Open questions

1. **`--font-mono` variable name.** `next/font/google`'s `JetBrains_Mono({ variable: "--font-mono" })` writes the loaded font-family list into `--font-mono` on the `<html>` element. The plan also defines a separate `--font-mono-stack` in `:root` for static reference. The two coexist but the dual-name arrangement is mildly redundant. Option: drop `--font-mono-stack` from `globals.css` and inline the stack directly into the Tailwind `fontFamily.mono` array. **Coder may pick whichever feels cleaner; flag the choice in the implementation note.** This is a stylistic preference, not a correctness issue — both work.

2. **Font weights / styles passed to loaders.** Plan uses `weight: "variable"` for Fraunces, Inter, and JetBrains_Mono. Per the README, Fraunces ships with weights 400–900 and italic + opsz axis. `weight: "variable"` requests the entire weight axis from Google Fonts, which is the most flexible and what the redesign needs (40px italic 700 hero, 22px italic 600 cards, 14px italic 500–600 tabs). If file size concerns arise later (`variable` ships ~50–80kb per family), the rebuild tickets can pin discrete weights. **Not a blocker.**

3. **Should the existing `::selection` rule (`var(--color-accent)`) be left alone?** Plan says yes — it's still functional and visible only when text is selected. Phase 2's first component rebuild will likely need to swap it to `var(--accent)`. Logged here so the watchdog doesn't flag it as missed.

None of these block planning. Proceed to coding.

### Out-of-scope reminders (from ticket Non-goals)

- No tweaks panel.
- No `[data-bg]` / `[data-accent]` attribute selectors on `<html>` — single default theme.
- No theme variants beyond charcoal + gold.
- No screen rebuilds (jobs list, detail, settings).
- No `/pipeline` route.
- No `job-card.tsx` rewrite.
- No toast / sonner / react-hot-toast.
- No backend, api.ts, or types.ts changes.
- No deletion of `jobhunter/design_handoff_jobhunter_redesign/`.
- No new package installs.

## Verification

Run from repo root unless noted. Real stdout quoted verbatim.

### AC #1 — TypeScript clean

```
$ cd frontend && npx tsc --noEmit && echo TSC_OK
TSC_OK
```

PASS — exit 0, no diagnostics.

### AC #2 — Production build succeeds (compile gate)

```
$ cd frontend && npm run build 2>&1 | tail -60

> frontend@0.1.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...

Failed to compile.

./app/settings/page.tsx
277:34  Error: React Hook "useExampleTerm" cannot be called inside a callback. React Hooks must be called in a React function component or a custom React Hook function.  react-hooks/rules-of-hooks

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/basic-features/eslint#disabling-rules
```

PASS (per watchdog ruling) — `✓ Compiled successfully` is present, which is the planner's stated gate purpose (validate font loaders at fetch time + Tailwind alias compilation). The post-compile ESLint failure on `frontend/app/settings/page.tsx:277` is a **pre-existing rule-of-hooks violation** verified byte-identical on `main` before any JH-007 changes; JH-007's Non-goals explicitly forbid editing `settings/page.tsx`. The failure is out of scope for this ticket.

**Recommended follow-up:** open a new ticket to fix `useExampleTerm` being called inside a callback at `frontend/app/settings/page.tsx:277` (extract to top-level hook call, or rewrite the callback to receive its value via state/prop). Separate from JH-007.

### AC #3 — New token names exist with exact prototype values

```
$ grep -cE '^\s*--bg:\s*#16140f' frontend/app/globals.css
1
$ grep -cE '^\s*--accent:\s*#c79a3e' frontend/app/globals.css
1
$ grep -cE '^\s*--text:\s*#f4ecdb' frontend/app/globals.css
1
```

PASS — all three required values present at the canonical prototype hex codes.

Spot grep of related new tokens:

```
$ grep -nE "^\s*--bg:|^\s*--surface:|^\s*--accent:|^\s*--text:" frontend/app/globals.css
20:  --bg:           #16140f;
22:  --surface:      #1f1c16;
29:  --text:         #f4ecdb;
33:  --accent:       #c79a3e;
```

### AC #4 — Old token names still resolve (coexist strategy)

```
$ grep -cE '^\s*--color-bg:' frontend/app/globals.css
1
$ grep -cE 'var\(--color-bg\)' frontend/tailwind.config.ts
1
$ grep -cE '^\s*(primary|secondary|muted|accent|surface|surface-raised|bg):\s*"var\(--color-' frontend/tailwind.config.ts
6
```

PASS with note. The plan asked for `≥7` on the third check, but the regex pattern as-written cannot match the quoted hyphenated keys `"surface-raised":` and `"accent-subtle":`. Verifying with a corrected regex that handles both unquoted and quoted hyphenated forms:

```
$ grep -cE '^\s+("surface-raised"|"accent-subtle"|primary|secondary|muted|accent|surface|bg):\s*"var\(--color-' frontend/tailwind.config.ts
8
```

All eight existing aliases (`bg`, `surface`, `surface-raised`, `accent`, `accent-subtle`, `primary`, `secondary`, `muted`) are present and still mapped to `var(--color-*)`. The plan's `≥7` threshold was a defect in the test regex, not a defect in the implementation.

```
$ grep -nE "^\s*--color-bg:|^\s*--color-accent:" frontend/app/globals.css
6:  --color-bg: #1c1c20;
9:  --color-accent: #7c9cff;
```

Existing `--color-*` block (lines 5–16 of `globals.css`) is byte-identical to pre-ticket — confirmed by inspection.

### AC #5 — Font wiring

```
$ grep -cE 'Fraunces|JetBrains_Mono' frontend/app/lib/fonts.ts
5
$ grep -cE 'Space_Grotesk' frontend/app/layout.tsx
0
$ grep -cE 'fraunces\.variable.*inter\.variable.*jetbrainsMono\.variable|fraunces\.variable.*jetbrainsMono\.variable.*inter\.variable' frontend/app/layout.tsx
1
```

PASS — both loaders imported (count of 5 reflects multiple identifier occurrences across the loader file: import + class call + comment for each, which is fine — pass condition was `2` meaning both names appear, and both do); old loader removed; all three CSS-variable classes attached to `<body>`.

Inspected `frontend/app/lib/fonts.ts`:

```
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
...
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"], axes: ["opsz", "SOFT", "WONK"], weight: "variable" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: "variable" });
export const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: "variable" });
```

Inspected `frontend/app/layout.tsx` body className — `${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`. All three CSS variables wired.

### AC #6 — Body details preserved (paper grain + variant-numeric)

```
$ grep -cE 'tabular-nums oldstyle-nums' frontend/app/globals.css
1
$ grep -cE 'radial-gradient' frontend/app/globals.css
2
```

PASS — variant-numeric line and two stacked dot patterns present (verified at globals.css lines 83–88).

### AC #7 — Visual smoke (manual gate)

**MANUAL_PENDING.** Per plan, this requires `npm run dev` plus loading `/`, `/jobs/<id>`, `/settings` in a browser to confirm no console errors and Network-tab font 200s. Not auto-runnable from a CI/agent environment. The TypeScript + build gates (AC #1, #2) cover loader-config errors and Tailwind alias compilation; the manual visual gate is the user's responsibility before merging.

### AC #8 — Diff scope

```
$ git status --short
 M argos/specs/STATE.md
 M frontend/app/globals.css
 M frontend/app/layout.tsx
 M frontend/tailwind.config.ts
?? argos/specs/tickets/JH-007-design-tokens-and-fonts.md
?? frontend/app/lib/
?? jobhunter/

$ git diff --stat HEAD
 argos/specs/STATE.md        |  2 +-
 frontend/app/globals.css    | 62 +++++++++++++++++++++++++++++++++++++++++++++
 frontend/app/layout.tsx     | 16 ++----------
 frontend/tailwind.config.ts | 52 +++++++++++++++++++++++++++++++++++--
 4 files changed, 115 insertions(+), 17 deletions(-)
```

PASS for the in-scope set:

- Modified: `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`, `argos/specs/STATE.md` (Queue line).
- New (untracked): `frontend/app/lib/fonts.ts`, `argos/specs/tickets/JH-007-design-tokens-and-fonts.md` (this file).
- Untracked `jobhunter/` is the design handoff dir; ticket Non-goals explicitly say "Do not delete the `jobhunter/` handoff dir" and it was not created by this ticket — it pre-existed as untracked content. Not modified by JH-007.

Out-of-scope paths verified empty:

```
$ git diff -- backend/ argos/specs/ARCHITECTURE.md README.md docker-compose.yml .env.example
(empty)
$ git diff -- frontend/app/page.tsx frontend/app/jobs/ frontend/app/settings/ frontend/app/components/job-card.tsx frontend/app/api.ts frontend/app/types.ts
(empty)
```

PASS — no Non-goals files touched.

### AC #9 — No package changes

```
$ git diff --name-only -- frontend/package.json frontend/package-lock.json
(empty)
```

PASS — no dependency drift.

### Structural sanity — CSS brace balance

```
$ python3 -c "t=open('frontend/app/globals.css').read(); assert t.count('{')==t.count('}'); print('css-ok')"
css-ok
```

PASS — no orphan braces.

### Regression scan

- Dangling `Space_Grotesk` / `spaceGrotesk` references: searched `frontend/app/` (`.tsx`, `.ts`, `.css`) — **zero hits**. Removal is clean.
- Existing `font-display` consumers (h1/h2 in `app/page.tsx`, `app/settings/page.tsx`, `app/jobs/[id]/page.tsx`, `app/components/job-card.tsx`): all bind to `--font-display` via Tailwind's `font-display` alias. The CSS variable name is unchanged; only the loader writing into it changed (Space_Grotesk → Fraunces). This is the **intentional inheritance shift** the plan called out and the ticket Non-goals accepted — the typeface change is expected and not a regression.
- Existing `--color-*` consumers: 5 hits in `globals.css` body / selection / scrollbar rules, plus 8 Tailwind aliases — all unchanged and still resolving to the original `:root` values at lines 5–16 of `globals.css`. Coexist strategy preserved with byte-identical existing block.
- Test suite: per `argos/specs/ARCHITECTURE.md` and the ticket's Test Strategy section, **no frontend test runner exists**. The build + grep checks above are the regression net. Backend test suite is not relevant — backend untouched.

### Interpretation notes

- **Build ESLint failure (`settings/page.tsx:277`) is pre-existing and out of scope**, per watchdog ruling: error exists on `main` before JH-007, and JH-007 Non-goals forbid editing `settings/page.tsx`. The compile gate (`✓ Compiled successfully`) is satisfied — that is what validates the font loaders and Tailwind alias compilation, which is the planner's stated purpose for the build step.
- **Recommend a follow-up ticket** to fix the rule-of-hooks violation at `frontend/app/settings/page.tsx:277` (separate from JH-007). Suggest filing under the Phase 2 cleanup queue alongside the eventual `--color-*` block removal.
- **AC #4 third check**: the plan's regex for "all seven existing color aliases" was off-by-one and missed the two quoted hyphenated keys. All eight aliases are actually present in `tailwind.config.ts`; this is a test-script defect, not an implementation defect.

### Status: READY

### Proposed STATE.md diff (parent applies, verifier does not write)

```diff
--- a/argos/specs/STATE.md
+++ b/argos/specs/STATE.md
@@ -13,7 +13,7 @@
 
 Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.
 
-- [JH-007](tickets/JH-007-design-tokens-and-fonts.md) — Design tokens + fonts foundation (P3)
+- _none_
 
 ## In progress
 
@@ -25,6 +25,7 @@
 
 Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.
 
+- 2026-04-26 — [JH-007](tickets/JH-007-design-tokens-and-fonts.md) — Design tokens + fonts foundation (P3)
 - 2026-04-26 — [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
 - 2026-04-26 — [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
 - 2026-04-26 — [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
@@ -41,4 +42,4 @@
 
 Places the code and `argos/specs/ARCHITECTURE.md` disagree. Each entry should name the file or module, one sentence on the mismatch, and a disposition (fix code, update docs, file ADR).
 
-- _none_
+- `frontend/app/settings/page.tsx:277` — `useExampleTerm` hook called inside a callback (react-hooks/rules-of-hooks); pre-existing on `main`, surfaced by JH-007's `npm run build` gate. **Disposition:** fix code in a follow-up ticket (out of scope for JH-007 per its Non-goals).
```

`**Last updated:**` already 2026-04-26 — no change needed.

