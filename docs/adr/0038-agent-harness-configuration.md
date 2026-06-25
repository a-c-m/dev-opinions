---
date: 2026-05-26
decision-makers: [Repo platform]
tags: [ai-agents, claude-code, opencode, hooks, harness-config]
---

# ADR 0038: Agent harness configuration

## Context and Problem Statement

[ADR 0037](0037-multi-agent-rule-distribution.md) settles the **cross-agent context layer** — `AGENTS.md`, skills, subagent layout, MCP, the rules for what lives in `.agents/`. It deliberately stops short of the harness runtime: the per-harness configuration that turns `AGENTS.md` into actual behaviour during a session.

This ADR covers that **harness runtime layer**: directory structure, hook philosophy, permission model, shell-script commands, session lifecycle, and how harness-managed memory composes with the project brief.

Claude Code is the day-one implementation. OpenCode is the planned second implementation, reaching parity via plugin per [ADR 0037](0037-multi-agent-rule-distribution.md).

## Decision Outcome

The two ADRs are complementary, not stacked:

- **ADR 0037** — what context every agent reads (cross-agent).
- **ADR 0038** — how a specific harness runs that context (per-harness).

### Directory layout (Claude Code)

```
.claude/
├── agents/             # subagents — per-harness, not symlinked (ADR 0037)
├── commands/           # *.sh path-invoked + *.md slash commands
├── hooks/              # PreToolUse / PostToolUse / SessionStart wiring
├── skills/             # symlinks to .agents/skills/<name>/ (ADR 0037)
├── settings.json       # permissions + hook wiring
└── README.md
```

Per-directory inventory and conventions live in [`.claude/README.md`](../../.claude/README.md) and [`.claude/hooks/README.md`](../../.claude/hooks/README.md). This ADR explains the *shape* and *why*; the READMEs stay current with the *what*.

### Hook philosophy — five tiers, all fail-don't-skip

Hooks split by *what they protect*, not by which tool triggers them. Filename prefix encodes the tier, so `ls .claude/hooks/` reads as a topology:

| Prefix | Lifecycle | Behaviour |
|--------|-----------|-----------|
| `validate-edit-*` | PreToolUse Edit\|Write | Content validator — blocks if proposed content fails the check. Runs against the *simulated post-edit file* via stdin, so the check acts on content being written, not stale on-disk content. |
| `block-bash-*` | PreToolUse Bash | Command guard — refuses Bash calls that would silently undo other guardrails (`--no-verify`, `bs update`, `--unsafe`, `gh issue create` bypassing the wrapper, bare `grep`, `coverage-baseline --allow-decrease`, command chaining, absolute repo paths). |
| `allow-bash-*` | PreToolUse Bash | Command auto-approver — emits an `allow` decision so a narrowly-scoped, known-safe Bash call skips the permission prompt (today: capturing an already-allowlisted command's output to `.ai-wip/`, which the permission engine otherwise prompts on because the redirect is an ungranted file-write). Adds no run-trust the allowlist didn't already grant. |
| `notify-*-*` | PostToolUse | Advisory only — emits a warning to stderr, exits 0. Catches what PreToolUse couldn't inspect (e.g., a commit subject coming from `$EDITOR`). |
| `bootstrap-session-*` | SessionStart | Runs once per session to prime context (today: surface ready beads). |

Hooks fail by exiting non-zero with a clear stderr message. None carry an escape hatch (no "skip if missing", no `|| true`). If a hook can't run because a tool is missing, that's a setup problem to fix, not a condition to swallow.

**Carve-out for `bootstrap-session-*`:** session bootstrappers are *context primers*, not guards. When their input isn't present (e.g. `bootstrap-session-beads.sh` and no `.beads/` directory because beads isn't used in this repo), they exit 0 silently — there is nothing to prime, so nothing to surface. This is not an escape hatch on a guard; the guard tiers (`validate-edit-*`, `block-bash-*`) still fail-don't-skip.

**Carve-out for `allow-bash-*`:** auto-approvers fail-don't-skip in the *opposite direction*. A guard's safe failure is to block; an auto-approver's safe failure is to **grant nothing** — so on any missing tool, error, or unmet condition it exits 0 with no decision, deferring to the normal permission prompt. It can only ever *add* an `allow`; a `deny`/exit-2 from any guard tier still wins (deny-first precedence), so an auto-approver can never widen what a guard blocks.

New hook? Pick the tier matching its lifecycle moment; name `<tier>-<surface>-<concern>.sh`. If no existing tier fits, that's an ADR amendment, not a naming exception.

### Permission model

`permissions.allow` / `permissions.deny` in `.claude/settings.json`. Two principles:

- **Pattern over enumeration.** `Bash(pnpm test:*)` rather than thirty individual entries. Patterns survive new sub-commands without churn.
- **Deny is the enforcement edge.** When the project policy is "use X, not Y" and both are technically available, the `deny` rule is what makes it real. Today: the built-in `Grep` tool is denied to force `rg`-via-Bash per [AGENTS.md](../../AGENTS.md); `git push --force`, `rm -rf`, and `git reset --hard` are denied to prevent the worst destructive accidents.

### Shell-script commands

`.claude/commands/{check,create-issue,create-pr}.sh` are path-invoked and harness-neutral in content. They sit under `.claude/` because that's where this harness happens to keep them; the scripts themselves don't depend on Claude Code. OpenCode parity comes from thin Markdown wrappers in `.opencode/commands/` that shell out to the same scripts (per [ADR 0037](0037-multi-agent-rule-distribution.md)).

Slash-command Markdown (`start.md`, `handover.md`) is *not* harness-neutral — frontmatter diverges per harness — so each harness keeps its own.

### Memory — project vs personal

Two sinks, deliberately separate, matching the two-tier shape used for tasks:

- **Project-shared** — facts every contributor benefits from. Go to the nearest `AGENTS.md` (root or per-folder). Subject to ADR 0037's ~150-line cap and inline-rationale rule. Committed; shared via git.
- **Personal** — facts about *this developer* (role, expertise, response-style preferences). Go to the harness's auto-memory. For Claude Code: `~/.claude/projects/<sanitized-cwd>/memory/`. Per-developer; not committed.

Before writing to auto-memory, the agent asks: *"would another contributor want this?"* If yes, it's project-shared — `AGENTS.md`, not auto-memory. If a memory turns out to be project-shared after the fact, promote it: delete the personal entry, add the AGENTS.md bullet.

**Harness implementation detail (Claude Code):** the `autoMemoryDirectory` setting is intentionally ignored when set in committed `.claude/settings.json` — Claude Code blocks projects from redirecting personal memory for security. So this split is enforced by *prompt discipline* (the rule above, surfaced in AGENTS.md), not by the harness configuration. OpenCode's equivalent has not been audited.

### Session lifecycle

`SessionStart` hook runs once per session to surface context the agent shouldn't have to re-derive — today, ready beads via `bootstrap-session-beads.sh`. Add new bootstrappers conservatively: a SessionStart hook that's slow or flaky degrades every session.

## Relationship to ADR 0037

| Layer | ADR | Covers |
|-------|-----|--------|
| Cross-agent context | [0037](0037-multi-agent-rule-distribution.md) | `AGENTS.md`, skills, subagent layout, MCP sync, `.agents/` |
| Per-harness runtime | 0038 (this) | Hooks, permissions, shell commands, memory split, session lifecycle |

Together they describe the full agent stack: 0037 defines what every agent *reads*; 0038 defines how this harness *runs*.

Earlier revisions of 0038 (originally "Claude Code configuration layout") assumed a single agent. The current revision absorbs that scope into the per-harness layer above, and removes overlap with 0037 (skills layout, subagent translation, MCP sync, folder READMEs — all live in 0037 now).

## Consequences

### Positive
- New projects inherit a reviewed baseline: hooks, permissions, commands, memory discipline.
- The split between content validators, command guards, and session bootstrappers keeps each hook short and single-purpose; the shell is reviewable.
- The memory split puts project rules in `AGENTS.md` (where collaborators can read them) and personal preferences in auto-memory (where they belong) — no per-developer noise gets committed.
- When OpenCode is onboarded, this ADR is the per-harness checklist to replicate.

### Negative
- Hook scripts are Bash and depend on `jq` — Windows contributors need WSL.
- The memory-split rule is enforced by prompt discipline, not the harness. An agent that ignores `AGENTS.md` will write project facts to personal memory.
- Configuration must be kept current as Claude Code features evolve; stale hooks or skill links mislead sessions.

## Alternatives considered

- **Lean (AGENTS.md + hooks + .mcp.json only)** — faster to set up; loses the ergonomics of agents, skills, and commands.
- **No shared baseline** — every project starts from zero.
- **Maintain it as a separate shared package** — cleaner long-term; captured as a follow-up below.
- **Move hooks and shell commands into `.agents/`** — rejected. ADR 0037's bar for `.agents/` is "shared open standard" (AGENTS.md, Agent Skills). Hooks are wired by `.claude/settings.json`, which OpenCode's bridge plugin reads. Moving the scripts renames the path without adding generality. See [.agents/README.md](../../.agents/README.md).

## Future work

- Extract the generic configuration into a shared package that multiple repos consume by reference rather than by copy.
- Audit OpenCode's memory equivalent once the harness lands; reconfirm the project-vs-personal split holds.
