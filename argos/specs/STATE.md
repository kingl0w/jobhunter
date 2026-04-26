# jobhunter — State

**Last updated:** 2026-04-26
**Updated by:** _verifier (automated) or human (on hotfix)_

This file is the project's short-term memory. Every subagent reads it first. Only the verifier writes it during the loop; humans write it on out-of-loop edits.

## Current focus

_One sentence. What is the single most important thing in flight right now? If you can't fit it in one sentence, you're focused on too many things._

## Queue

Tickets ready to be worked, in rough priority order. The planner picks the top one on `/next` unless told otherwise.

- _none_

## In progress

Tickets currently being executed by the loop or paused mid-cycle. At most one per operator.

- [ ] _none_

## Done this cycle

Tickets completed since the last cycle close. Cleared when you close a cycle (weekly, by default). Append-only within a cycle.

- 2026-04-26 — [JH-008](tickets/JH-008-fix-rules-of-hooks-settings.md) — Fix rule-of-hooks violation in settings/page.tsx (P2)
- 2026-04-26 — [JH-007](tickets/JH-007-design-tokens-and-fonts.md) — Design tokens + fonts foundation (P3)
- 2026-04-26 — [JH-006](tickets/JH-006-phase-1-closeout-drift-reconciliation.md) — Phase 1 closeout — reconcile resolved drift entries in ARCHITECTURE and PRD (P3)
- 2026-04-26 — [JH-005](tickets/JH-005-readme-scoring-drift.md) — Fix README scoring drift — clarify keyword matching, not LLM (P3)
- 2026-04-26 — [JH-004](tickets/JH-004-remove-unsupported-source-filters.md) — Remove zip_recruiter and google from frontend source filter (P3)
- 2026-04-26 — [JH-003](tickets/JH-003-remove-dead-resume-path-envs.md) — Remove dead IT_RESUME_PATH and DEV_RESUME_PATH from .env.example (P3)
- 2026-04-26 — [JH-002](tickets/JH-002-remove-dead-database-url.md) — Remove dead DATABASE_URL from docker-compose.yml (P3)
- 2026-04-24 — [JH-001](tickets/JH-001-readme-gemini-api-key.md) — Fix README API key drift: ANTHROPIC_API_KEY → GEMINI_API_KEY (P3)

## Open decisions

Product or architecture calls that are pending and block one or more queued tickets. Each becomes an ADR once decided.

- _none_

## Known drift

Places the code and `argos/specs/ARCHITECTURE.md` disagree. Each entry should name the file or module, one sentence on the mismatch, and a disposition (fix code, update docs, file ADR).

- _none_
