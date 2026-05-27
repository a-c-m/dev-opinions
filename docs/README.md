# docs

This tree carries the decisions, conventions, and operational procedures for the repo. The code itself is documentation for *how*; this tree is documentation for *why* and *what to do when*.

## Layout

| Path | What lives here |
|---|---|
| [`adr/`](adr/AGENTS.md) | Architecture Decision Records — the *why* behind every load-bearing choice. Indexed in [`adr/AGENTS.md`](adr/AGENTS.md). New significant decisions get a new ADR per the MADR-lite shape described there. |
| [`conventions/`](conventions/) | Reference material for conventions that an ADR ratified but doesn't need to inline (e.g. the script-verb table for [ADR 0004](adr/0004-nx-monorepo.md)). |
| [`runbooks/`](runbooks/) | Operational procedures — on-call under pressure. Cross-cutting runbooks live here; service-specific ones live under `apps/<product>/<service>/runbooks/`. Format per [`runbooks/AGENTS.md`](runbooks/AGENTS.md); start from [`runbooks/TEMPLATE.md`](runbooks/TEMPLATE.md). |
| [`sops/`](sops/) | Standard Operating Procedures — developer doing normal work. Same shape as runbooks; different audience. Cross-cutting SOPs live here; service-specific ones (rare) live under `apps/<product>/<service>/sops/`. Format per [`sops/AGENTS.md`](sops/AGENTS.md); start from [`sops/TEMPLATE.md`](sops/TEMPLATE.md). |
| [`incidents/`](incidents/) | Filed post-mortems (RCAs) from past SEV1/SEV2 incidents and recurring SEV3s. One file per incident, `YYYY-MM-DD-<slug>.md`. Format per [`incidents/AGENTS.md`](incidents/AGENTS.md); start from [`incidents/TEMPLATE.md`](incidents/TEMPLATE.md). Blameless by policy ([ADR 0040](adr/0040-incident-management.md)). |
| [`handbook/`](handbook/) | Engineering handbook — people-and-process norms (development flow, spikes, incidents, meetings, chat, career, onboarding). Principles and expectations, **not** stack decisions and not "do these exact steps" procedures. Indexed in [`handbook/README.md`](handbook/README.md). |
| [`QUICKSTART.md`](QUICKSTART.md) | First-clone bootstrap — system prerequisites, `pnpm install`, smoke check. |

## When in doubt

- Adding a load-bearing decision → new ADR under `adr/`, then index it in [`adr/AGENTS.md`](adr/AGENTS.md).
- Adding a long reference table or naming alphabet → `conventions/<topic>.md`, linked from the ADR that ratified it.
- Adding an "I do this every time X happens" doc → runbook (incident-shaped) or SOP (process-shaped). Copy the matching `TEMPLATE.md`.
- Filing an RCA after an incident → `incidents/YYYY-MM-DD-<slug>.md` from [`incidents/TEMPLATE.md`](incidents/TEMPLATE.md). See [handbook/incidents.md](handbook/incidents.md) for the protocol.
- Adding a people-or-process norm (how we plan, review, meet, grow) → `handbook/<topic>.md`.
- Adding a one-off how-to that doesn't fit any of the above → it probably belongs in `AGENTS.md` (root or per-app), not here.

## Related

- [`/AGENTS.md`](../AGENTS.md) (with `/CLAUDE.md` as a committed symlink) — operating rules and conventions for any agent or contributor working in this repo.
- [`/docs/adr/AGENTS.md`](adr/AGENTS.md) — ADR index with one-line hooks per decision.
