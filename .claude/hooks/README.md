# `.claude/hooks/` — four tiers, named by prefix

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
| `notify-*-*` | PostToolUse | Advisory only — emits a warning, never blocks. |
| `bootstrap-session-*` | SessionStart | Runs once per session to prime context. |

New hook? Pick the tier that matches its lifecycle moment, then name `<tier>-<surface>-<concern>.sh`. If no existing tier fits, that's a 0038 amendment, not a naming exception.

Hooks **fail-don't-skip** (no `|| true`, no "skip if missing"). If a hook can't run because a tool is absent, fix the setup — don't make the hook optional.

## Current inventory

| File | Tier | Purpose |
|------|------|---------|
| `validate-edit-biome.sh` | content validator | Run biome against the *proposed* file contents (via stdin) before the edit lands. |
| `validate-edit-no-wait.sh` | content validator | Block `page.waitForTimeout` in test files — forces deterministic waits. |
| `block-bash-git.sh` | command guard | Block `--no-verify`, direct `gh issue create` / `gh pr create`, missing ticket suffix on `git commit`. |
| `block-bash-biome.sh` | command guard | Block `bs update` (mutates the baseline) and biome/bs `--unsafe` (changes semantics). |
| `block-bash-rules.sh` | command guard | Catch-all for command-shape rules: `&&`/`\|\|` chaining, `/tmp/` redirects, absolute repo paths, bare `grep`/`egrep`/`fgrep`, `coverage-baseline … --allow-decrease`, nudges for `echo>`/`cat<<`/`sed -i`/`awk >`. |
| `notify-edit-biome.sh` | advisory | Post-edit biome diagnostics — surfaces issues the validator missed (e.g., problems only visible once the file is on disk). |
| `notify-bash-commit.sh` | advisory | After `git commit`, warn if the subject breaks Conventional Commits or the ticket-suffix rule (catches commits authored via `$EDITOR` that PreToolUse can't inspect). |
| `bootstrap-session-beads.sh` | session primer | Surface ready beads at SessionStart so the agent doesn't have to ask. |

Wiring lives in [.claude/settings.json](../settings.json). Permission rules live there too; see [.claude/README.md](../README.md) for the directory-level map.
