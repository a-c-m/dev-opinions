---
status: superseded in part by ADR-0028
date: 2026-04-19
---

# ADR 0029: Claude Code configuration layout

## Context and Problem Statement

Claude Code sessions are productive in proportion to how much project-specific context, automation, and guardrails they can see without being told. Without a baseline, every new project re-derives its own set of agents, hooks, commands, and MCP wiring — inconsistently and usually incompletely. A shared baseline turns Claude Code into a consistent collaborator across the portfolio.

## Decision Outcome

[ADR 0028](0028-multi-agent-rule-distribution.md) supersedes the parts of this ADR that assumed a single agent: (a) the single-agent context model, (b) the flat `.claude/skills/*.md` layout (each skill is now a directory containing `SKILL.md`), and (c) `CLAUDE.md` as the primary brief (now a committed symlink to `AGENTS.md`). The `.claude/` directory structure and the hook philosophy below remain authoritative.

The template ships a curated `.claude/` layout:

```
.claude/
├── agents/
│   ├── code-reviewer.md          # independent review pass
│   ├── testing-specialist.md     # test strategy + coverage
│   └── devops-expert.md          # CI/CD, deploy, infra
├── hooks/
│   ├── biome-check.sh                # PreToolUse Edit/Write: validate proposed content via biome stdin
│   ├── post-edit-checks.sh           # PostToolUse Edit/Write: advisory biome diagnostics on the edited file
│   ├── prevent-wait-for-timeout.sh   # PreToolUse Edit/Write: block page.waitForTimeout in test files
│   ├── check-biome-commands.sh       # PreToolUse Bash: block `bs update` (baseline mutation must be deliberate)
│   ├── check-biome-unsafe.sh         # PreToolUse Bash: block biome/bs `--unsafe` (can change semantics)
│   ├── check-git-commands.sh         # PreToolUse Bash: block `--no-verify` and direct `gh issue create`
│   ├── echo-detection.sh             # PreToolUse Bash: nudge when a bash heredoc/sed should be Write/Edit
│   └── commit-format.sh              # PostToolUse Bash: warn when a commit subject breaks Conventional Commits
├── commands/
│   ├── check.sh                  # full quality gate: lint + typecheck + test
│   ├── create-issue.sh           # gh issue create wrapper
│   ├── create-pr.sh              # gh pr create wrapper
│   ├── start.md                  # per-session priming
│   └── handover.md               # hand off session state
├── skills/
│   ├── commit-standards.md
│   ├── pr-creation.md
│   ├── pr-review.md
│   └── quality-checks.md
└── settings.json                 # permissions + hook wiring
```

Plus:
- **Root `CLAUDE.md`** — repo-wide conventions, the scripts that matter, MCP tools available, and where further context lives.
- **Per-app `CLAUDE.md`** — created by a generator when scaffolding a new app; keeps app-local detail out of the root.
- **`.mcp.json`** — `context7` (docs lookup), `playwright` (browser control), `chrome-devtools` (inspection). Stagehand is opt-in per-project.

### Hook philosophy

Hooks split into two layers on purpose:

- **Content validators** (pre-edit biome-check, post-edit advisory, prevent-wait-for-timeout) ensure that what Claude writes meets the repo's standards before or immediately after the edit lands. Pre-edit validation runs biome against a simulated post-edit file via stdin, so the check acts on the content being written, not the stale on-disk file.
- **Command guards** (check-biome-commands, check-biome-unsafe, check-git-commands) block specific *commands* that would silently undo other guardrails — `bs update` hides new lint errors, `--unsafe` can change semantics, `--no-verify` skips the whole pre-commit ratchet, `gh issue create` bypasses the project issue template.

Hooks fail by exiting non-zero with a clear stderr message. None of them carry an escape hatch (no "skip if missing", no `|| true`). If a hook cannot run because a tool is missing, that is a setup problem to fix, not a condition to swallow.

## Consequences

### Positive
- New projects inherit a reviewed baseline; they do not reinvent hooks, agents, or commands from scratch.
- Layered `CLAUDE.md` keeps the root concise and pushes app-local detail down to the app.
- A small, generic agent set is a useful starting shape without becoming noise.
- The split between content validators and command guards makes each hook short and single-purpose, which keeps the shell-scripts reviewable.

### Negative
- The configuration has to be kept current as Claude Code features evolve; stale hooks or skills mislead sessions.
- Hook scripts are bash and depend on `jq`, which means Windows contributors need WSL.

## Alternatives considered

- **Lean (CLAUDE.md + hooks + .mcp.json only)** — faster to set up; loses the ergonomics of agents, skills, and commands.
- **No shared baseline** — every project starts from zero.
- **Maintain it as a separate shared package** — cleaner long-term; captured as a follow-up below.

## Future work

- Extract the generic configuration into a shared package that multiple repos can consume by reference, rather than by copy.
