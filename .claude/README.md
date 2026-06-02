# `.claude/` — Claude Code harness configuration

This directory holds **Claude Code-specific** wiring for this repo. The cross-agent canonical layer lives in [`.agents/`](../.agents/README.md) and [`AGENTS.md`](../AGENTS.md).

Authoritative ADRs:
- [ADR 0037](../docs/adr/0037-multi-agent-rule-distribution.md) — cross-agent context layer (AGENTS.md + skills + folder layout).
- [ADR 0038](../docs/adr/0038-agent-harness-configuration.md) — per-harness runtime layer (hooks, permissions, commands, memory).

## What's here

| Path | Purpose | Canonical or symlinked? |
|------|---------|-------------------------|
| `agents/*.md` | Subagents (`code-reviewer`, `devops-expert`, `testing-specialist`). | **Canonical** — frontmatter diverges per harness, never symlinked. |
| `commands/*.sh` | Shell-script commands (`check`, `create-issue`, `create-pr`). Invoked by path. | **Canonical** — harness-neutral in content, lives here by convention. OpenCode parity via thin wrappers in `.opencode/commands/`. |
| `commands/*.md` | Slash-command markdown (`/start`, `/handover`). | **Canonical** — frontmatter is Claude-Code-specific. |
| `hooks/*.sh` | PreToolUse / PostToolUse / SessionStart hooks. | **Canonical** — wired by `settings.json`; OpenCode bridges via plugin. |
| `skills/<name>/` | Agent Skills. | **Symlinks** to `.agents/skills/<name>/` per ADR 0037. |
| `settings.json` | Permissions + hook wiring. | **Canonical** — Claude-Code-specific format. |
| `settings.local.json` | Personal per-developer overrides. | **Gitignored.** |

## Adding a new asset — where does it go?

- **Project rule that every contributor benefits from** → `AGENTS.md` (root or per-folder), not here.
- **Personal preference of this developer** → `~/.claude/projects/<sanitized-cwd>/memory/` (Claude Code auto-memory), not here.
- **Cross-agent skill** (SKILL.md format) → `.agents/skills/<name>/`, symlinked back here.
- **Subagent** → `agents/<name>.md` here (per-harness; translate, don't symlink).
- **Hook or shell command** → here (`hooks/`, `commands/`). See [`.agents/README.md`](../.agents/README.md) for why these aren't in `.agents/`.
- **Permission rule** → `settings.json`. Prefer patterns over enumeration; use `deny` to enforce "use X, not Y" project rules.

When in doubt, the decision rule from [`.agents/README.md`](../.agents/README.md) applies: *is there a shared open standard for this asset's format that multiple harnesses agree on?* If yes, it goes in `.agents/`. If no, it stays per-harness here.

## Output verbosity — quiet by default

Tool output is a major token sink, so the harness defaults to quiet and surfaces failures. Opt back in per source:

- **lefthook** — `output: false` ([`lefthook.yml`](../lefthook.yml)); more via `LEFTHOOK_OUTPUT=…`.
- **pnpm / NX noise** — `env` vars in [`settings.json`](settings.json): `NPM_CONFIG_GLOBALCONFIG=/dev/null` (skips the `~/.npmrc` read the sandbox blocks anyway) and `NX_TUI=false` (no escape-sequence TUI). Agent-scoped (your shell keeps full output); override per-call, e.g. `NX_TUI=true pnpm test`.

Not muted on purpose: pnpm's `Unsupported engine` warning is real drift ([`.nvmrc`](../.nvmrc) pins node 22.19.0) — `nvm use`, don't silence.
