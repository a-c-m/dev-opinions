---
date: 2026-05-22
decision-makers: [Repo platform]
tags: [ai-agents, claude-code, opencode, agents-md]
---

# ADR 0037: AGENTS.md as the cross-agent context standard

## Context and Problem Statement

[ADR 0038](0038-claude-code-setup.md) configured this repo for
Claude Code only. We want to expand the set of agents the repo
briefs — OpenCode now (model flexibility against the same project
context), Codex CLI plausibly later. As a base-app template, forks
may settle on different agents from the ones we use here.

`AGENTS.md` is the only cross-tool open standard in 2026. The
standard pattern is **one source file (`AGENTS.md`) with
`CLAUDE.md` symlinked to it**, not two hand-maintained copies.

Empirical signal in 2025–2026 (the [agents.md spec adopter list](https://agents.md/),
GitHub's late-2025 analysis of `AGENTS.md` files across public repos,
practitioner reports from teams running 3+ agents): well-scoped
hand-written `AGENTS.md` reduces agent runtime and output tokens
materially over multi-file or LLM-generated briefs. The same reports
flag over-long files and architectural-overview prose as *negative*
for task success. Command-first, boundary-first, short.

## Decision Outcome

`AGENTS.md` is the single source of truth for cross-agent context.
Tool-specific config is hand-maintained; OpenCode hook parity via
plugin.

### Source-of-truth layout

```
AGENTS.md                                   # canonical brief (~150 line soft cap)
CLAUDE.md -> AGENTS.md                      # symlink (committed)

.agents/skills/<name>/SKILL.md              # canonical skill source
.claude/skills/<name>   -> ../../.agents/skills/<name>     (symlink)
.opencode/skills/<name> -> ../../.agents/skills/<name>     (symlink)

.claude/agents/<name>.md                    # canonical Claude subagents (per-harness)
.opencode/agent/<name>.md                   # canonical OpenCode agents (translated, NOT symlinked)

.mcp.json                                   # canonical MCP servers
opencode.json                               # hand-maintained; mirrors mcp block

.claude/settings.json                       # Claude-only: permissions, hooks
opencode.json plugin: [opencode-claude-hooks]   # OpenCode hook bridge
```

Symlink only where the format is a shared standard (agents.md for
context; Agent Skills for skills). Subagents diverge per harness —
translate, don't symlink. Git tracks symlinks; GitHub renders them.

### What goes in `AGENTS.md`

Command-first, boundary-first. In priority order:

1. One-line project identity.
2. Stack with versions.
3. Commands with full flags — including single-file variants
   (`pnpm exec tsgo --noEmit <path>`, `pnpm exec biome check <path>`).
4. Definition of done — the exact commands an agent runs before
   claiming a task complete.
5. Boundaries: Always / Ask first / Never — naming specific
   files/dirs, not principles.
6. Non-obvious conventions only.
7. Repo map by *capability*, not path.
8. Pointers to deeper docs via `@docs/...` (progressive disclosure).

Excluded: linter-enforced style rules, file-tree listings,
architectural overviews. They cost tokens; per ETH Zurich,
sometimes they hurt.

### Principles

- **Toolchain first.** If a linter/type-checker/formatter/hook
  already enforces it, don't restate it. The tool *is* the
  constraint.
- **`AGENTS.md` for AI; `README.md` for humans.** Same project,
  different audiences. `AGENTS.md` is command-first and
  budget-conscious; `README.md` narrates for human onboarding.
- **Soft cap ~150 lines.** Research-backed. Not CI-enforced — the
  right number depends on the project — but push past it and you
  owe the next reader an explanation. Applies to ADRs too.
- **Inline rationale.** When a rule is added, record *why* next to
  it. Rules without rationale get deleted by the next editor.
- **Review on signal, not on calendar.** Update when a PR
  introduces a new convention or an agent makes the same mistake
  twice — same logic applied to runbook/SOP staleness (`git log`,
  not a decorative `last-reviewed:` field).

### Per-directory `AGENTS.md`

Most rules live in root `AGENTS.md`. Two narrower scopes:

- **Per-app `AGENTS.md` — expected.** Each
  `apps/<product>/<service>/` carries one for app-specific
  conventions, stack, and "don't touch" notes. Generators
  scaffold it.
- **Per-folder `AGENTS.md` — optional.** Any folder with distinct
  content worth briefing (e.g., `docs/adr/`, `shared/<lib>/`) may
  carry one. Nearest-wins up to root.

For dual-audience folders — same content serves both an agent
reading the directory and a human browsing on GitHub — **`README.md`
is a symlink to `AGENTS.md`**. Same trick as the repo-root
`CLAUDE.md → AGENTS.md`. One source, two access paths, zero drift.
`docs/adr/` is the first concrete instance.

For finer scoping than directories (file-type globs), use the
per-agent native mechanism when available — Cursor's
`.cursor/rules/*.mdc` with frontmatter globs, Claude Code's
`.claude/rules/*.md` if supported. We don't ship a shared
generation layer.

### Claude-only extensions

`.claude/` remains Claude Code's local config home (settings.json,
hooks, permissions). Claude-only additions to the agent brief
attach via a short pointer (`.claude/CLAUDE-NOTES.md` imported
from CLAUDE.md via `@`) rather than diverging the symlink.

### OpenCode hook parity

`.claude/settings.json` hooks are Claude Code's mechanism.
OpenCode reaches parity via
[`magarcia/opencode-claude-hooks`](https://github.com/magarcia/opencode-claude-hooks)
registered in `opencode.json` `plugin`. The README claims
`SessionStart`, `PreToolUse`, `PostToolUse`, and exit-code-2
blocking. **Confidence is low**: 1 star, single author. Treat
Claude Code as authoritative, OpenCode as best-effort. Fallback if
the plugin proves insufficient: lift bash guardrails into wrapper
scripts around `pnpm`/`gh`.

### Skills layout migration

[ADR 0038](0038-claude-code-setup.md) shipped flat
`.claude/skills/*.md` files. Each skill is promoted to
`.agents/skills/<name>/SKILL.md`; per-agent skill directories
become per-entry symlinks. Safe because the Agent Skills open
standard defines a shared `SKILL.md` format.

### Subagent files don't symlink

Claude Code and OpenCode subagent frontmatter diverges — model
identifiers, tool flags, permissions. A symlink would silently
load broken configs.

- Each harness keeps its own canonical copy
  (`.claude/agents/`, `.opencode/agent/`).
- Only `.claude/agents/` exists until OpenCode is onboarded.
- When OpenCode lands, add a generator
  ([Ruler](https://github.com/intellectronica/ruler) or a bespoke
  `make generate`). Pick then.

Same rule for any slash-command Markdown with harness-specific
frontmatter. Shell-script commands are unaffected.

### Shell-script commands

`.claude/commands/{check,create-issue,create-pr}.sh` stay in
place — invoked by path, not as slash commands. For OpenCode
parity, thin Markdown wrappers in `.opencode/commands/` shell out
to the same scripts.

### MCP config sync

`.mcp.json` is canonical for Claude Code; `opencode.json` `mcp`
block mirrors it by hand. Three servers today — small enough for
hand-sync. A lefthook `pre-commit` drift check warns (not blocks).
If the MCP set grows past ~6 servers or we add a third agent,
revisit generation-based sync (Ruler).

### Folder READMEs

Each agent's config directory gets a `README.md` at its **root
only** — `.claude/README.md`, `.opencode/README.md` — explaining
layout, what's canonical vs symlinked, and pointing back here.

**Not** inside `agents/` or `skills/` subdirectories: OpenCode's
loader globs `{agent,agents}/**/*.md` and would register a README
as an agent named `README`.

## Relationship to ADR 0038

[ADR 0038](0038-claude-code-setup.md) remains authoritative for
`.claude/` itself (hook philosophy, agents/commands shape). This
ADR supersedes 0029's single-agent assumptions: the single-agent
context model, the flat `.claude/skills/*.md` layout, and
`CLAUDE.md` as the primary brief.

## Consequences

### Positive

- **One file to write, two agents read it** — change to brief is a
  single edit; CLAUDE.md follows automatically.
- **No new tooling.** Symlinks are an OS primitive; forks inherit
  a working multi-agent setup without installing anything.
- **GitHub discoverability preserved** — CLAUDE.md and AGENTS.md
  render on github.com.
- **Adding a third agent is bounded** — a context-file pointer + a
  config file. No recurring drift cost.
- **Skills/agents live once** — editing the wrong copy is
  structurally impossible.

### Negative

- **Windows contributors need a shim.** Symlinks require
  `core.symlinks=true` + developer mode. Lefthook generates a
  CLAUDE.md duplicate on `post-checkout` for them.
- **MCP block is hand-synced** (three entries today). Drift check
  warns; doesn't prevent. Past ~6 servers, revisit.
- **OpenCode hook parity is unverified** — bridge plugin barely
  adopted. Load-bearing risk of the OpenCode-supported claim.
- **Subagents need a generator, not a symlink** — frontmatter
  diverges per harness; deferred until OpenCode lands.

### Neutral

- CLAUDE.md as symlink: `git status` shows it as a link. Editing
  it edits AGENTS.md — intended.
- Per-app `CLAUDE.md` (from generators) becomes per-app
  `AGENTS.md` with a `CLAUDE.md` symlink.

## Alternatives considered

1. **Ruler-based generation from `.ruler/`.** Scales cleanly to 4+
   agents and unifies MCP config; but for 2 agents Ruler's
   machinery dwarfs the problem (hand-sync surface is the MCP
   block and the symlink). Revisit at the third agent. Rejected
   for now.
2. **Hand-maintain separate `CLAUDE.md` and `AGENTS.md`.**
   Guaranteed drift; the empirical research is unambiguous that
   the content is overwhelmingly common across agents. Rejected.
3. **Keep Claude-only, no `AGENTS.md`.** Contradicts contributor
   practice and the template's premise of model flexibility.
   Rejected.
4. **Gitignore generated files, regenerate via SessionStart
   hook.** Bootstrap-ordering fragile, GitHub renders nothing,
   Codex has no session-hook surface, silent overwrites of
   contributor edits. Rejected.
## Related

- [ADR 0038](0038-claude-code-setup.md) — original Claude-only
  configuration; superseded in part.
- [agents.md spec &amp; adopter list](https://agents.md/)
- [Ruler](https://github.com/intellectronica/ruler) — the
  generation-based alternative; right tool for 3+ agents.
- [opencode-claude-hooks](https://github.com/magarcia/opencode-claude-hooks)
  — Claude Code hook compatibility shim for OpenCode. Best-effort.
