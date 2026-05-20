# `.claude/agents/`

Subagents isolate context for one type of task — file reads, search results, and exploratory tool calls stay in the subagent's context and never touch the main thread. They do not make Claude smarter; they preserve the quality of context that already exists.

## Naming convention

Subagents are invoked by `@agent-name` (or selected via description matching). The name carries scope:

| Scope | Name pattern | Examples |
|---|---|---|
| Repo-wide capability | bare name | `code-reviewer`, `testing-specialist`, `devops-expert` |
| Product-scoped knowledge | `<product>-*` | e.g. `tool1-graphql-flow` for product-specific knowledge |
| Service-scoped (rare) | `<product>-<service>-*` | only when the agent truly doesn't apply at the product level |

Tech-cross-cutting agents (Svelte, Drizzle) get bare names — they apply everywhere we use that tech. Product-specific knowledge gets the prefix.

## Where they live

**Root only.** Verified against [Claude Code docs](https://code.claude.com/docs/en/sub-agents.md) "Choose the subagent scope": agent discovery walks up from cwd, never down into subdirectories. An agent at `apps/<product>/.claude/agents/foo.md` would not be loaded.

This is why agent names carry the scope prefix even though their content is product-specific.

## Model selection

Default to `model: sonnet` for new subagents. Sonnet is the safety net while we build sample sizes on real PR outcomes.

| Subagent shape | Recommended model |
|---|---|
| Pattern-following along a well-known chain (schema → codegen, lint-fix, refactor-rename) | `sonnet` (downgrade to `haiku` only after A/B on real work) |
| Code review / structured feedback on a known stack | `inherit` for now; `haiku` is a candidate per Tessl's 880-eval benchmark |
| Multi-file architectural reasoning, novel debugging, visual judgment | `sonnet` |
| Genuinely hard reasoning the user is paying Opus for in the main thread anyway | `inherit` |

The Tessl benchmark ([blog post](https://tessl.io/blog/anthropic-openai-or-cursor-model-for-your-agent-skills-7-learnings-from-running-880-evals-including-opus-47/)) found Haiku-with-skill (84.3%) beat baseline Opus (80.5%) at ~1/5 the cost — but the 11 skills tested were narrow-stack coding skills and the lift is aggregate. Capture invocation outcomes in `.ai-wip/` before downgrading existing agents.

## Authoring a subagent

Use the `name`, `description`, `tools`, `model` frontmatter. Keep the body tight (current agents are ~40 lines; the failure mode is 200-line agents with `**MANDATORY**: READ THE DOCS` blocks — instruction-following degrades with count).

Subagents do **not** inherit parent skills. List skills the subagent needs in frontmatter `skills:` so they pre-load.

Subagents **cannot spawn subagents** (no nested forking). If your design needs that, restructure.
