# `.claude/hooks/` — five tiers, named by prefix

Hooks split by *what they protect*, not by which tool triggers them. Filename prefix encodes the tier, so `ls` reads as a topology.

See [ADR 0038](../../docs/adr/0038-agent-harness-configuration.md) for the philosophy; this file is the inventory + naming rule.

## Naming convention

```
<tier>-<surface>-<concern>.sh
```

| Tier prefix | Lifecycle | Behaviour |
|-------------|-----------|-----------|
| `validate-edit-*` | PreToolUse Edit\|Write | Content validator — blocks if proposed content fails the check. |
| `block-bash-*` | PreToolUse Bash | Command guard — blocks the Bash call before it runs. |
| `allow-bash-*` | PreToolUse Bash | Command auto-approver — emits an `allow` so a known-safe Bash call skips the prompt. Fails *closed* by deferring (never a spurious allow). |
| `notify-*-*` | PostToolUse | Advisory only — emits a warning, never blocks. |
| `bootstrap-session-*` | SessionStart | Runs once per session to prime context. |

New hook? Pick the tier that matches its lifecycle moment, then name `<tier>-<surface>-<concern>.sh`. If no existing tier fits, that's a 0038 amendment, not a naming exception.

Hooks **fail-don't-skip** (no `|| true`, no "skip if missing"). If a hook can't run because a tool is absent, fix the setup — don't make the hook optional. The `allow-*` tier inverts the *direction*, not the principle: an auto-approver fails **closed** by deferring (emit no decision → the normal prompt), since granting nothing is the safe failure for a hook whose job is to grant.

## Wire hooks with `$CLAUDE_PROJECT_DIR`, never a relative path

Hook `command`s MUST be absolute and quoted — `"$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"`, so they run when in a `repos/*` sub-repo.

## Current inventory

| File | Tier | Purpose |
|------|------|---------|
| `validate-edit-biome.sh` | content validator | Run biome against the *proposed* file contents (via stdin) before the edit lands. |
| `validate-edit-no-wait.sh` | content validator | Block `page.waitForTimeout` in test files — forces deterministic waits. |
| `block-bash-git.sh` | command guard | Block `--no-verify`, force-push variants, `git -C` / `gh --repo`, direct `gh issue create` / `gh pr create`, `git branch -d`/`-D`/`--delete`, missing ticket suffix on `git commit`. |
| `block-bash-biome.sh` | command guard | Block `bs update` (mutates the baseline) and biome/bs `--unsafe` (changes semantics). |
| `block-bash-rules.sh` | command guard | Catch-all for command-shape rules: `&&`/`\|\|` chaining, `/tmp/`·`$TMPDIR`·`/var/folders/` and `../` parent-escape redirects, absolute repo paths, bare `grep`/`egrep`/`fgrep`, `coverage-baseline … --allow-decrease`, nudges for `echo>`/`cat<<`/`sed -i`/`awk >`. |
| `allow-bash-capture.sh` | command auto-approver | Auto-approve `<X> > .ai-wip/<name>` when `<X>` is already in `permissions.allow` (and not denied), so the "capture output" convention stops prompting. Adds no run-trust — the command still runs sandboxed, deny rules still win, and the flat `.ai-wip/` target can't escape. |
| `notify-edit-biome.sh` | advisory | Post-edit biome diagnostics — surfaces issues the validator missed (e.g., problems only visible once the file is on disk). |
| `notify-bash-commit.sh` | advisory | After `git commit`, warn if the subject breaks Conventional Commits or the ticket-suffix rule (catches commits authored via `$EDITOR` that PreToolUse can't inspect). |
| `bootstrap-session-beads.sh` | session primer | Surface ready beads at SessionStart so the agent doesn't have to ask. |

## Shared logic — `lib/`

`lib/scrub-command.sh` strips heredoc bodies and quoted-string contents.

Wiring lives in [.claude/settings.json](../settings.json). Permission rules live there too; see [.claude/README.md](../README.md) for the directory-level map.
