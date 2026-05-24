# ADR 0024: AGENTS.md as the cross-agent context standard

- **Status**: Proposed
- **Date**: 2026-05-22
- **Deciders**: Repo platform
- **Tags**: ai-agents, claude-code, opencode, agents-md

## Context

[ADR 0012](0012-claude-code-setup.md) configured this repo for Claude
Code only. We want to expand the set of agents the repo briefs —
OpenCode first (model flexibility: Codex, Groq, local Ollama against
the same project context), Codex CLI plausibly later, and whatever the
next agent is the year after. As a base-app template this needs to be
*forkable* — downstream repos may settle on different agents from the
ones we use here, and the cost of getting it wrong is paid by every
fork. Each agent looks for a different context file and config layout:

| Agent       | Context file | Tool config              | Agents dir         | Skills dir        |
|-------------|--------------|--------------------------|--------------------|-------------------|
| Claude Code | `CLAUDE.md`  | `.claude/settings.json`, `.mcp.json` | `.claude/agents/`  | `.claude/skills/` |
| OpenCode    | `AGENTS.md`  | `opencode.json` (`mcp`, `plugin`, `instructions`) | `.opencode/agents/` | `.opencode/skills/` |
| Codex CLI   | `AGENTS.md`  | `.codex/config.toml`     | `.codex/agents/`   | —                 |

`AGENTS.md` is the only cross-tool open standard in 2026, stewarded by
the Linux Foundation's Agentic AI Foundation and natively read by
OpenAI Codex, Cursor, GitHub Copilot, Windsurf, Codex CLI, Aider, Zed,
Warp, Factory, and OpenCode. Claude Code reads `CLAUDE.md`. The
standard practice in repos that target both is **one source file
(`AGENTS.md`) with `CLAUDE.md` symlinked to it**, not two
hand-maintained copies.

Empirical evidence shapes the rest:

- Lulla et al. (arXiv:2601.20404, Jan 2026): a well-scoped
  developer-written `AGENTS.md` cuts median agent runtime 28.64% and
  output tokens 16.58%.
- Gloaguen et al. (ETH Zurich, arXiv:2602.11988, Feb 2026):
  LLM-generated context files **reduce** task success ~3% and inflate
  cost 20–23%. Hand-written files help only ~4% and still add ~19%
  cost. Architectural overviews and directory-listing prose are
  actively harmful — agents don't find files faster with them.
- GitHub blog analysis of 2,500+ files (Nov 2025): the top-performing
  ones are command-first, name specific files/dirs in Always/Ask/Never
  boundaries, and stay short.

Implication: every line in this repo's context file should earn its
place. Long architectural prose, file-tree listings, and rules a
linter already enforces are net-negative.

## Decision

Adopt `AGENTS.md` as the single source of truth for cross-agent
context. Manage tool-specific config files by hand; bridge to OpenCode
where required.

### Source-of-truth layout

```
AGENTS.md                                   # canonical brief (≤200 lines)
CLAUDE.md -> AGENTS.md                      # symlink (committed)

.agents/skills/<name>/SKILL.md              # canonical skill source
.claude/skills/<name>   -> ../../.agents/skills/<name>     (symlink)
.opencode/skills/<name> -> ../../.agents/skills/<name>     (symlink)

.claude/agents/<name>.md                    # canonical agent source
.opencode/agents/<name>.md -> ../../.claude/agents/<name>.md  (symlink)

.mcp.json                                   # canonical MCP servers
opencode.json                               # hand-maintained; mirrors mcp block

.claude/settings.json                       # Claude-only: permissions, hooks
opencode.json plugin: [opencode-claude-hooks]   # OpenCode hook bridge
```

No tooling layer. Symlinks are the OS primitive. `git` tracks them.
GitHub renders the symlink target so discoverability is preserved.

### What goes in `AGENTS.md`

Per the empirical research, command-first and boundary-first, not
prose-first. The high-signal sections, in priority order:

1. One-line project identity.
2. Stack with versions (frontmatter pinning, e.g. "pnpm 9, Node 22,
   tsgo, Biome 2, Vitest, NestJS, Drizzle").
3. Commands with full flags, **including single-file variants**
   (`pnpm exec tsgo --noEmit <path>`, `pnpm exec biome check <path>`,
   `pnpm exec vitest run <path>`).
4. Definition of done (the exact commands an agent runs before
   claiming a task complete).
5. Boundaries: Always / Ask first / Never — naming specific
   files/dirs, not principles.
6. Non-obvious conventions only (what an agent can't infer from the
   code or what linters/tsconfig don't already enforce).
7. Repo map by **capability**, not path (per Pocock and Datadog
   guidance — paths drift, capabilities don't).
8. Pointers to deeper docs via `@docs/...` (progressive disclosure).

Linter-enforced style rules, file-tree listings, and architectural
overviews are **excluded**. They cost tokens and don't help — per ETH
Zurich, sometimes they hurt.

### Claude-only extensions

The `.claude/` directory remains Claude Code's local config home
(settings.json, hooks, permissions). The Claude-side extensions to
`AGENTS.md` — Claude-specific commands, hooks, or skill behaviours —
live alongside as small additions, not as a duplicate of the brief.

If a Claude-only addition is needed beyond the symlinked AGENTS.md,
the pattern is a short pointer file (e.g. a `.claude/CLAUDE-NOTES.md`
imported from CLAUDE.md via `@`) rather than diverging the symlink.

### OpenCode hook parity

`.claude/settings.json` hooks (PreToolUse Bash guardrails, Edit/Write
biome-check, PostToolUse commit-format, SessionStart) are Claude
Code's mechanism. OpenCode reaches parity via the
[`magarcia/opencode-claude-hooks`](https://github.com/magarcia/opencode-claude-hooks)
plugin, registered in `opencode.json` `plugin`. Per its README it
claims full support for SessionStart, PreToolUse, PostToolUse, and
exit-code-2 blocking with `Edit|Write` regex matchers.

**Confidence is low**: 1 star, single author, last touched February
2026. We treat Claude Code hooks as authoritative and OpenCode hook
coverage as best-effort. The `README.md` "AI Coding Agent Setup"
section calls this out. If the plugin proves insufficient, the
fallback is to lift the bash guardrails into shell wrappers around
`pnpm`/`gh` so they run regardless of agent.

### Skills layout migration

[ADR 0012](0012-claude-code-setup.md) shipped flat
`.claude/skills/*.md` files. To support symlinking from multiple
agents' skill directories without duplication, each skill is promoted
to `.agents/skills/<name>/SKILL.md`. The per-agent skill directories
become per-entry symlinks. Claude Code reads through the symlink
without changes; OpenCode follows the `{agent,agents}` and equivalent
skills glob.

### Shell-script commands

`.claude/commands/{check,create-issue,create-pr}.sh` stay in place —
they're invoked by path, not as slash commands. For OpenCode parity,
thin Markdown wrappers in `.opencode/commands/` shell out to the same
scripts. Single implementation, two invocation surfaces.

### MCP config sync

`.mcp.json` is canonical for Claude Code; `opencode.json` `mcp` block
mirrors it by hand. Today that's three servers (context7, playwright,
chrome-devtools) — small enough that hand-sync is correct. A lefthook
`pre-commit` check warns on drift between the two by parsing both and
comparing the `mcp` keys; not blocking, just a nudge. If we add a
fourth agent or the MCP set grows past ~6 servers, revisit
generation-based sync (Ruler being the obvious candidate, see
Alternatives).

### Folder READMEs

Each agent's config directory gets a small `README.md` at its **root
only** — `.claude/README.md`, `.opencode/README.md` — explaining the
layout, what is canonical vs symlinked, and pointing back to this
ADR.

**Not** inside `agents/` or `skills/` subdirectories: OpenCode's
loader globs `{agent,agents}/**/*.md` and registers every match as an
agent. A README placed there would be loaded as an agent named
`README`. The globbed subfolders stay strictly content-only.

## Relationship to ADR 0012

[ADR 0012](0012-claude-code-setup.md) remains authoritative for the
`.claude/` directory itself — hook philosophy, agents/commands/skills
shape for Claude Code's local config. This ADR supersedes the parts
of 0012 that assumed Claude Code was the only agent: the single-agent
context model, the flat `.claude/skills/*.md` layout, and the
implicit ownership of `CLAUDE.md` as the primary brief.

## Consequences

### Positive

- **One file to write, two agents read it.** A change to the project
  brief is a single edit to `AGENTS.md`. CLAUDE.md follows by virtue
  of being the same file.
- **No new tooling.** Symlinks are an OS primitive that every dev
  already knows. Forks inherit a working multi-agent setup without
  needing to install Ruler, `npx`, or anything else.
- **GitHub discoverability preserved.** `CLAUDE.md` renders at the
  repo root on github.com (it's a symlink target, not a generated
  artefact). Same for `AGENTS.md`.
- **Adding a third agent is bounded work.** A new agent typically
  needs (a) a context file pointing at `AGENTS.md` and (b) a config
  file with its native flavour of MCP/instructions/plugins. Both
  done in an afternoon, no recurring drift cost.
- **Aligns with empirical research.** Short, hand-curated,
  command-first `AGENTS.md` is the shape Lulla et al. measured at
  -28.64% runtime / -16.58% output tokens.
- **Skills/agents live once.** `.agents/skills/<name>/` is the
  source; per-tool dirs are per-entry symlinks. Editing the wrong
  copy is structurally impossible.

### Negative

- **Windows contributors need a shim.** Git supports symlinks on
  Windows only when `core.symlinks=true` and developer mode or admin
  rights are set. For Windows contributors who can't run symlinks,
  lefthook generates a `CLAUDE.md` duplicate from `AGENTS.md` on
  `post-checkout`. Worth flagging in onboarding; tracked as a known
  rough edge.
- **MCP block is hand-synced.** Three entries today. A lefthook
  drift check catches divergence but doesn't prevent it. If the MCP
  set grows past ~6 servers, this becomes annoying enough to
  reconsider — see Alternatives.
- **OpenCode hook parity is unverified.** The bridge plugin is barely
  adopted. If it breaks under real use we either contribute fixes
  upstream or fall back to wrapper scripts. This is the
  load-bearing risk of the "OpenCode is supported" claim.

### Neutral

- **CLAUDE.md is now a symlink.** `git status` and `ls -l` show it as
  a link, not a regular file. Anyone editing it edits AGENTS.md —
  intended, but worth noting once.
- **Per-app `CLAUDE.md` (from generators) becomes per-app
  `AGENTS.md` with `CLAUDE.md` symlink.** Generator templates update
  accordingly.

## Alternatives considered

### 1. Ruler-based generation from `.ruler/`

Use [Ruler](https://github.com/intellectronica/ruler) to generate
`CLAUDE.md`, `AGENTS.md`, `opencode.json` `mcp`, and `.codex/config.toml`
from a single `.ruler/` source. Pre-commit hook enforces sync.

- **Pro**: scales cleanly to 4+ agents (Ruler's sweet spot).
- **Pro**: single source for MCP servers across all agent configs.
- **Pro**: adding a new agent is one flag in `ruler.toml`.
- **Con**: Ruler is a new dependency contributors and forks must
  learn. Generated files in PR diffs add visual noise.
- **Con**: for 2 agents, the hand-sync surface is *the MCP block*
  and *the symlink* — Ruler's machinery dwarfs the problem.
- **Con**: the empirically-documented majority pattern is "AGENTS.md
  + symlink" (Linux Foundation spec, 60k+ adopting repos). Ruler is
  forward-cover for an agent set we don't have.

Rejected for now. Revisit when adding a third agent — Ruler remains
the obvious tool at that point.

### 2. Hand-maintain separate `CLAUDE.md` and `AGENTS.md`

- **Pro**: each file can diverge per-agent.
- **Con**: guaranteed drift. The empirical research is unambiguous
  that the content is overwhelmingly common across agents; divergence
  is a bug, not a feature. Rejected.

### 3. Keep Claude-only, no `AGENTS.md`

- **Pro**: ADR 0012 stands unchanged.
- **Con**: contradicts existing contributor practice and the
  template's premise of model flexibility. Rejected.

### 4. Gitignore generated files, regenerate via SessionStart hook

Each agent's SessionStart hook regenerates context files; nothing
committed but `.ruler/`.

- **Con (bootstrap)**: Claude Code reads CLAUDE.md into its system
  prompt at session start; OpenCode reads opencode.json at process
  start. Ordering between hook and config-read is fragile.
- **Con (discoverability)**: github.com renders nothing useful.
- **Con (parity)**: Codex has no session-hook surface, so the
  approach already breaks for the third agent we plan to support.
- **Con (silent overwrites)**: contributor edits lost on next
  session.

Rejected.

### 5. Long `ARCHITECTURE.md` with prose overview

- **Pro**: familiar to humans, matklad-style.
- **Con**: ETH Zurich evidence is direct: architectural overviews
  cost tokens and don't help agents locate files. Agents already
  navigate the codebase faster than they parse prose. Rejected for
  agent context; if a human-facing architecture doc is needed it
  lives under `docs/architecture/` and is linked from `AGENTS.md` via
  progressive disclosure (`@docs/architecture/README.md`).

## References

- [agents.md spec & adopter list](https://agents.md/) — Linux
  Foundation Agentic AI Foundation.
- Gloaguen, Mündler, Müller, Raychev, Vechev. *Evaluating AGENTS.md*
  — arXiv:2602.11988, Feb 2026. Empirical evidence on what does and
  doesn't help.
- Lulla, Mohsenimofidi, Galster, Zhang, Baltes, Treude.
  *AGENTS.md efficiency study* — arXiv:2601.20404, Jan 2026. Runtime
  and token impact of well-scoped files.
- Nigh, Matt. *How to write a great agents.md — Lessons from over
  2,500 repositories.* The GitHub Blog, Nov 19, 2025.
- [Ruler](https://github.com/intellectronica/ruler) — the
  generation-based alternative; right tool for 3+ agents.
- [opencode-claude-hooks](https://github.com/magarcia/opencode-claude-hooks)
  — Claude Code hook compatibility shim for OpenCode. Best-effort.
- [OpenCode docs — Agents](https://opencode.ai/docs/agents) — loader
  globs `{agent,agents}/**/*.md`; constrains README placement.
- [ADR 0010](0010-lefthook.md) — git hook runner, where the
  symlink-shim, MCP drift check, and AGENTS.md line cap live.
- [ADR 0012](0012-claude-code-setup.md) — original Claude-only
  configuration; this ADR supersedes the single-agent parts.
- [ADR 0020](0020-ripgrep-over-grep.md) — example of a cross-agent
  rule that benefits from single-source distribution via `AGENTS.md`.
