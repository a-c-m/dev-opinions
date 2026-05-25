# repos/

Optional sibling to [`apps/`](../apps/). Holds **independent child git repositories** that share parent-level agent context but live in their own version-controlled repos.

Per [ADR 0005](../docs/adr/0005-child-apps-and-repos.md):

- Children in `repos/<name>/` are NOT pnpm workspace members and are excluded from the NX project graph.
- Each child owns its own `package.json`, lockfile, ADRs, hooks, CI — works standalone.
- This directory exists so an agent run at the parent root sees both `apps/*` workspace members AND independent `repos/*` siblings.
- Capability is opt-in by population: empty `repos/` directory = repo only has `apps/`.
- No git-hook cascading; the parent's hooks don't run on child repo commits.

If you have no need for independent child repos, ignore this directory — it does nothing on its own. The `.gitkeep` exists to make the convention visible.
