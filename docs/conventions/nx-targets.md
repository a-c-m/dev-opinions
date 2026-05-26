# NX target conventions

NX caches typecheck/lint/test results, which is great when it works. On developer machines with multiple long-lived `nx dev <app>` processes from sibling repos, however, **any `nx affected` or `nx run-many` call spawned by lefthook hangs at 0% CPU forever** — the child pnpm sits in `uv__io_poll` waiting on a kevent that never fires.

The same commands invoked directly from a terminal work fine. The hang is specific to the lefthook → `sh -c` → `pnpm exec nx …` chain interacting with whatever NX-daemon state is already alive on the host.

Two rules result.

## Rule 1 — Git hooks (lefthook) bypass NX

```yaml
# lefthook.yml — ✅ Use
pre-commit:
  commands:
    typecheck:
      run: pnpm -r typecheck

pre-push:
  commands:
    lint:      { run: pnpm lint:check }   # biome at root, no NX wrapper
    typecheck: { run: pnpm -r typecheck } # each leaf's `tsgo --noEmit`
    test:      { run: pnpm -r test }      # each leaf's `vitest run`
```

```yaml
# 🚫 Don't (any NX shape — both `affected` and `run-many` hang here)
typecheck:
  run: pnpm exec nx run-many --target=typecheck --all
```

You lose NX's cache in the hook — but `pnpm -r typecheck` cold across this workspace is < 5s; the cache speedup wasn't load-bearing.

## Rule 2 — Outside hooks: `nx run-many`, never `nx affected`, for typecheck and lint

```sh
# ✅ Use from a terminal or in CI
pnpm exec nx run-many --target=typecheck --all
pnpm exec nx run-many --target=lint --all

# 🚫 Don't
pnpm exec nx affected --target=typecheck
pnpm exec nx affected --target=lint
```

Even outside lefthook, `nx affected` with `tsgo` or Biome has been observed deadlocking under the same conditions. `run-many` reliably finishes. `nx affected --target=test` (Vitest) is fine and stays.

## Where this is enforced

- **`lefthook.yml`** — pre-commit + pre-push use `pnpm -r` / `pnpm lint:check`, never NX.
- **`.github/workflows/ci.yml`** — uses `nx run-many` for lint + typecheck (CI never showed the deadlock; the NX cache is worth keeping in CI), `nx affected` for test.
- **`package.json` scripts** — `pnpm typecheck` and `pnpm lint:check` are the root entry points dev tooling should call. `pnpm check:affected` uses `nx run-many` for tc+lint, `nx affected --target=test`.
- **`.claude/hooks/block-bash-rules.sh` rule 7** — blocks the agent from running `nx affected --target=typecheck` or `nx affected --target=lint` with a stderr message pointing at this doc. (Run-many is allowed; the block targets the documented-bad shape.)

## When to revisit

If lefthook's NX hang is fixed upstream (Nx CLI > 22.x, tsgo plugin update, or a clean reproduction emerges that lets us tell daemon-state from lefthook spawning), drop Rule 1 and switch lefthook back to `nx run-many`. Re-check by running `git commit` with a long-lived `nx dev` from another repo alive — if it completes, the bug's gone.
