# Sandbox configuration

How `.claude/settings.json` → `sandbox` is set up, and why. Applies to commands
Claude Code runs via the Bash tool; your own interactive shell is unaffected.

## What the sandbox does

With `sandbox.enabled: true`, every Bash command runs inside the macOS Seatbelt
sandbox:

- **Writes** are confined to the workspace (the repo root). Writes elsewhere fail
  with `Operation not permitted`.
- **Network** egress is denied except `sandbox.network.allowedDomains`
  (GitHub + the npm registry).
- **Reads are NOT confined by default** — this is the gap. A sandboxed command can
  otherwise read anything your user can, including `~/.ssh`, `~/.aws`, shell
  history, etc. We close that with `filesystem.denyRead`.
- **`autoAllowBashIfSandboxed: false`** is set explicitly. Leaving it unset lets
  the sandbox auto-approve *any* sandboxable command — bypassing `permissions.allow`.

This is OS-level containment. 

## Why `denyRead`

A prompt-injected or buggy agent's highest-value targets on a dev box are
**secret managers, registry tokens, and CLI auth** — `filesystem.denyRead` blocks reads of those; the kernel returns `EPERM` when a command tries anyway.

### Re-allowed (`allowRead`) — our tools need these

- `~/.config/git` — XDG git config, if used.

(`gh` itself isn't listed here — it's in `excludedCommands`, so it runs outside
the sandbox entirely and reads its token from the system keychain. No `allowRead`
carve-out is needed for it.)

### Deliberately NOT denied — and why

- `~/.ssh` — the `repos/*` checkouts use **SSH remotes** (`git@github.com:…`), so
  `git fetch`/`push` needs the keys. Denying it would break git.
- `~/.gitconfig` — git identity (lives at `~/.gitconfig`, not under `~/.config`,
  so the `~/.config` deny doesn't touch it).

## excludedCommands

- `gh *` — GitHub CLI. We exclude it because it needs to read secrets from the system keychain.

## Caveats

- **Sub-repo writes.** `repos/*` symlink to checkouts outside the workspace, so
  the sandbox blocks writes there. To edit/commit in a sub-repo, add its real
  path to `permissions.additionalDirectories` and `sandbox.filesystem.allowWrite`.
  See [repos/README.md](../../repos/README.md).
