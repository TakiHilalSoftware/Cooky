# Cooky: project docs

These documents are the **complete specification for building Cooky from scratch**. At the start, nothing in them exists yet. Build in the order given in [ROADMAP.md](ROADMAP.md), and treat these docs as the source of truth. When code and docs disagree, fix one of them on purpose; don't let them drift.

| Doc | Read it when |
| --- | --- |
| [PRD.md](PRD.md) | You need to know **what** to build: features, tiers and tries, UX standards, non-functional requirements |
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need to know **how**: stack, server/client boundary, database schema, pipelines |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | You're creating a file and need to know **where** it goes |
| [AGENT_RULES.md](AGENT_RULES.md) | **Always.** Rules for every line of code (AI agents and humans) |
| [SETUP_KEYS.md](SETUP_KEYS.md) | You're connecting a third-party service or preparing a deployment |
| [ROADMAP.md](ROADMAP.md) | You're deciding what to build next and when a phase is done |
| [LEGACY_IMPORT.md](LEGACY_IMPORT.md) | *Optional.* Only if users must be migrated from the earlier Cooky app's database |

**Markers:** *(proposal)* = a price or number to validate before launch. *(Pro)* / *(Plus+)* = the plan that unlocks a feature.

**For AI agents:** start every session by reading `AGENT_RULES.md`, then the section of the PRD and ARCHITECTURE for the feature you're working on. A good `CLAUDE.md` / `AGENTS.md` for this project contains:

```md
@docs/AGENT_RULES.md
Specs live in docs/ (index: docs/README.md). Build order: docs/ROADMAP.md.
```
