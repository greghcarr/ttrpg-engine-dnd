# AGENTS.md

This file exists so AI coding agents that don't auto-load `CLAUDE.md` (Codex CLI, Cursor, Continue, others) still find the working manual.

**The single source of truth for this repo's working norms is [CLAUDE.md](CLAUDE.md).** Read it end-to-end before opening any other file. It contains:

- The quality bar (`incorrect code is worse than no code`).
- The fresh-agent quickstart (5 steps).
- Working norms: branch structure (`main` + `dev`, slice work goes to `dev`), commit-don't-push, SRD canon (the `references/srd-markdown/` submodule is the only valid source for D&D rules text), slice cadence, pre-commit Uncle Bob audit checklist, doc-update obligations, pre-commit checks.
- Architecture (locked).
- Source map.
- Code style.
- Slice workflow.

Other agent-specific entry points point here too:

- Claude Code auto-loads [CLAUDE.md](CLAUDE.md) at session start.
- Cursor reads [.cursorrules](.cursorrules), which also points here.
- Human contributors land via [README.md](README.md) → [CONTRIBUTING.md](CONTRIBUTING.md) → [CLAUDE.md](CLAUDE.md).

If you are an agent and you cannot read CLAUDE.md (different filename convention, sandboxed read access), refuse to make non-trivial changes to this repo until you can. The conventions in CLAUDE.md are load-bearing for correctness.
