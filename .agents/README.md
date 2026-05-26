# `.agents/` — cross-agent canonical assets

Home for assets shared across **every** agent harness this repo briefs (Claude Code today; OpenCode and others plausibly later).

Authoritative ADR: [ADR 0037 — AGENTS.md as the cross-agent context standard](../docs/adr/0037-multi-agent-rule-distribution.md).

## The bar for living here

**Only assets backed by a shared open standard go in `.agents/`.** Two today:

- **Cross-agent context** — `AGENTS.md` (lives at repo root, not here; this dir is for *assets*, not the brief itself).
- **Agent Skills** — `.agents/skills/<name>/SKILL.md`. Each per-harness skills directory (`.claude/skills/<name>`, `.opencode/skills/<name>`) is a **symlink** to the canonical copy here.

If a thing isn't a defined open format that multiple harnesses agree on, it doesn't belong here. Moving it manufactures pretend-generality and creates a maintenance burden for no real portability gain.

## What is deliberately NOT in `.agents/`

These are harness-specific and stay in `.claude/` (and `.opencode/` when it lands), even though the *content* might look generic:

- **Hooks** (`.claude/hooks/*.sh`). Bash scripts are content-agnostic, but they're wired by `.claude/settings.json`, which is Claude-Code-specific. OpenCode reaches hook parity via [`magarcia/opencode-claude-hooks`](https://github.com/magarcia/opencode-claude-hooks) — a plugin that *reads* `.claude/settings.json`. Moving the scripts here would just rename the path and risk breaking the bridge.
- **Shell-script commands** (`.claude/commands/*.sh`). Invoked by path; humans and agents call them directly. Moving them is pure renaming churn — they're already harness-neutral in content.
- **Slash-command markdown** (`.claude/commands/*.md`). Frontmatter is harness-specific (Claude Code's command schema ≠ OpenCode's). ADR 0037 explicitly excludes these.
- **Subagents** (`.claude/agents/*.md`). Frontmatter diverges per harness — model IDs, tool flags, permissions. A symlink would silently load broken configs. Per-harness canonical copies; translate, don't symlink.
- **Settings** (`.claude/settings.json`). Permissions, hook wiring, env. Harness-specific by definition.

## Decision rule, summarised

> "Is there an open standard for this asset's format that multiple agent harnesses already agree on?"
> &nbsp;&nbsp;Yes → canonical copy in `.agents/`; per-harness symlinks.
> &nbsp;&nbsp;No → keep it in the harness directory (`.claude/`, `.opencode/`); generate or translate per harness if needed.

Two standards qualify today: `AGENTS.md` and Agent Skills. The list grows only when a new shared format earns the same level of cross-tool adoption.
