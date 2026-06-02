# repos/

Optional sibling to [`apps/`](../apps/). Holds **independent child git repositories** that share parent-level agent context but live in their own version-controlled repos.

Per [ADR 0005](../docs/adr/0005-child-apps-and-repos.md):

- Children in `repos/<name>/` are NOT pnpm workspace members and are excluded from the NX project graph.
- Each child owns its own `package.json`, lockfile, ADRs, hooks, CI — works standalone.
- This directory exists so an agent run at the parent root sees both `apps/*` workspace members AND independent `repos/*` siblings.
- Capability is opt-in by population: empty `repos/` directory = repo only has `apps/`.
- No git-hook cascading; the parent's hooks don't run on child repo commits.
- Claude hooks (block-bash-git etc) do still apply in sub repos.

If you have no need for independent child repos, ignore this directory — it does nothing on its own. The `.gitkeep` exists to make the convention visible.

## ⚠️ Sandbox + Sym Linked child repos: allow the paths manually

Claude Code's sandbox (`.claude/settings.json` → `sandbox`) confines **writes** to the workspace, so it will **block writes** to a symlinked checkout that lives outside it. So you need to add:

- `permissions.additionalDirectories` — so the Read/Edit/Write tools can reach the checkout.
- `sandbox.filesystem.allowWrite` — so commands (`git commit`, builds, generators) can write there.

NOTE; Restart Claude Code after editing settings — sandbox changes don't hot-reload.

## ⚠️ Capturing command output: stay inside the sub-repo

The root convention is `cmd > .ai-wip/<name>.log 2>&1` ([AGENTS.md](../AGENTS.md) → "Capture output for review"). Once you've `cd`'d into `repos/<name>` (its own Bash call — see [AGENTS.md](../AGENTS.md) → "Sub-repos under `repos/*`"), **don't** reach back to the root with `../../.ai-wip/…` as **it may resolve to the wrong place.** (outside the workspace due to symlink).

Instead, either:

- (preferred) **Capture inside the sub-repo:** go into `repos/<name>/.ai-wip/` (may need to gitignore .ai-wip)
- **Let small output print** and read it from the tool result
