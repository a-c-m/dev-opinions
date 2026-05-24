# ADR 0025: Child code layout — `apps/` and `repos/`

- **Status**: Proposed
- **Date**: 2026-05-22
- **Tags**: ai-agents, multi-repo, layout

## Context

[ADRs 0012](0012-claude-code-setup.md) and [0024](0024-multi-agent-rule-distribution.md)
set up agent context for *one* repo. A new use case has surfaced:
**cross-repo context**. Working on a web client, the agent should
also be able to read its server; organizational ADRs that live in
one repo should surface to the agent when working anywhere related.

base-app is a template. Forks may have one repo's worth of code
(the existing monorepo, in `apps/`), several independent repos
(new), both, or neither. The same template must support all four
shapes without flags or init steps.

The value is **agent context**, not git-hook coordination. Earlier
drafts explored cascading hooks across a wrapper and its children;
that path was abandoned — the wrapper widens what the agent can see
and the rules it knows to follow, not what `git commit` enforces.

## Decision

Two parallel directories under the repo root, each optional:

- **`apps/`** — pnpm workspace members. The existing monorepo
  capability per [ADR 0005](0005-nx-monorepo.md). One git history,
  shared lockfile, NX-aware.
- **`repos/`** — independent child git repos. Each owns its
  `.git`, `package.json`, `pnpm-lock.yaml`, `node_modules`,
  lefthook, and `AGENTS.md`. Excluded from the parent's
  `pnpm-workspace.yaml` and `nx.json` project graph.

Both ship empty (with `.gitkeep`). Forks populate either, both, or
neither. No flag, no init, no toggle — the agent reads what is
there.

### Children under `repos/`

- Live at `repos/<name>/` by convention; the parent's exclusions
  specifically reference `repos/`.
- Are **cloned standalone outside the parent with no functional
  difference**. The parent adds context; it does not modify the
  child.

### Cross-repo context for the agent

The agent is invoked **at the parent root**, making it the Claude
Code / OpenCode project root. From there:

- Cross-repo reads are cwd-relative paths: `repos/server/src/...`
  resolves naturally.
- Commits land in the nearest `.git`: `cd repos/client && git commit`
  commits to the client's history.
- The parent's `.claude/settings.json` is the project-level config —
  hooks, permissions, MCP servers all apply to work in any child
  directory.

No discovery marker, no env var. Static relative paths at setup
time are sufficient. Tooling that needs to enumerate children
walks `repos/*/` and checks for a nested `.git/`.

### Sibling discovery in `AGENTS.md`

The parent's `AGENTS.md` carries a curated one-line entry per
child plus a pointer to that child's own `AGENTS.md` for full
detail — progressive disclosure per
[ADR 0024](0024-multi-agent-rule-distribution.md). Hand-maintained
as children are added.

### Rule inheritance

- **Claude Code config** inherits automatically (project root =
  parent root).
- **Git hooks**: no cascading. Each `.git` runs its own lefthook.
- **ADR enforcement when editing a child**: agentic. The parent's
  `AGENTS.md` instructs the agent to surface and seek clarification
  when proposed work counters a parent ADR. Specific ADRs that
  ship hooks ([0020](0020-ripgrep-over-grep.md) →
  `check-bash-rules.sh`) keep firing — they're project-level.

### Use case coverage

- **Reference**: read base-app on GitHub; [docs/adr/README.md](README.md)
  index makes cherry-picking cheap.
- **Starter**: `git clone base-app && rm -rf .git && git init`,
  populate `apps/` or `repos/` or both.
- **Umbrella**: clone, drop independent repos into `repos/`. Value
  materializes the moment children appear.

No upstream sync from base-app. Forks diverge from day one.

## Consequences

### Positive

- **Cross-repo agent context with zero coupling.** Children stay
  independent; the agent reads across them via plain relative paths.
- **Capability is opt-in by population.** Same template, four
  shapes, no special-casing.
- **Hook-enforced rules apply universally** within the parent —
  Claude Code picks them up from project root.
- **Standalone children unaffected.** A child cloned outside the
  parent works identically to one cloned inside.

### Negative

- **Duplicated `node_modules` per child** — children are not
  workspace members.
- **No mechanical enforcement of parent ADRs in children.** Soft,
  prompt-side. Specific ADRs can be promoted to hook-enforced.
- **Cross-repo context requires invoking the agent at the parent
  root.** A contributor who `cd`s into a child first gets the child's
  standalone context only. Documented in the parent's `AGENTS.md`.

### Neutral

- Value scales with how many related repos a contributor works
  across. Single-child workflows could just `cd` in.
- Forks that never use `repos/` pay nothing — empty directory, no
  effect.

## Alternatives considered

1. **Submodules** — pin children to specific commits. UX is famously
   painful and we don't want pinning. Rejected.
2. **Workspace-member children (children in `apps/`)** — shares
   `node_modules` and tool versions, but contradicts "independent
   children" (lockfile, version pins). pnpm can't natively exclude
   `.git`-bearing dirs from a workspace glob. Rejected.
3. **Marker-file discovery (`.umbrella-marker`)** — no runtime needs
   discovery when the agent always starts at the parent root.
   Rejected.
4. **Git-hook cascade via `lefthook extends:`** — breaks for
   standalone children, and the parent's `nx affected` hooks don't
   work inside a child anyway. Wrong layer. Rejected.
5. **Generated child overview in `AGENTS.md`** — another sync
   mechanism for negligible benefit at small child counts. Curated
   one-liners are cheap. Rejected; reconsider past ~10 children.
6. **Hook-enforced ADR guardrails** — a generic "ADR validator"
   produces false positives faster than catches. Specific ADRs get
   specific hooks; there is no general validator. Rejected.
7. **Published npm config package (`@org/base-app-config`)** — heavy
   infrastructure for prose markdown; contradicts the "template you
   fork and own" model. Rejected.

## Relationship to prior ADRs

- **Extends [ADR 0024](0024-multi-agent-rule-distribution.md)**:
  cross-agent context now spans multiple repos. No supersedence.
- **Depends on [ADR 0012](0012-claude-code-setup.md)**: Claude
  Code's project-root model is the load-bearing primitive.
- **Parallel to [ADR 0005](0005-nx-monorepo.md)**: `apps/`
  (workspace monorepo) and `repos/` (independent siblings) are
  sibling capabilities.

## References

- [agents.md spec](https://agents.md/) — `AGENTS.md` format.
- [ADR 0024](0024-multi-agent-rule-distribution.md) — extended here.
