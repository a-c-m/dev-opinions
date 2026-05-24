---
date: 2026-04-26
decision-makers: [Tooling / DX]
tags: [tooling, search, claude-code, scripting]
---

# ADR 0009: Ripgrep over grep for all search

## Context and Problem Statement

Searching the working tree is one of the most frequent operations in this repo — by humans, by CI scripts, by the Claude Code agent and its sub-agents. Two tools could fill that role:

- **POSIX `grep`** — universally present; no install step; the default for decades.
- **[ripgrep (`rg`)](https://github.com/BurntSushi/ripgrep)** — a Rust-based recursive grep that is faster, respects `.gitignore`/`.ignore`/`.rgignore` by default, has built-in glob and file-type filters, parallelises across cores, and ships a single static binary.

In a monorepo of this size, the gap between the two is not subtle. Ripgrep is typically an order of magnitude faster on cold caches and avoids matching against `node_modules/`, `dist/`, `.nx/`, lockfiles, generated TypeScript, and other directories that bare `grep -r` will happily traverse. The result with `grep` is either slow searches or noisy false positives — usually both.

There is also a Claude Code-specific dimension. Claude Code's built-in `Grep` tool wraps ripgrep, so when an agent searches via that tool it already gets ripgrep's behaviour for free. Reaching for `grep` in a Bash tool call is a deliberate downgrade: it is slower, it ignores `.gitignore`, it bypasses the structured output the `Grep` tool gives back, and it splits the team's mental model between two regex engines (POSIX BRE/ERE for `grep`, RE2-with-PCRE2-fallback for `rg`).

We have, until now, allowed both. The result has been inconsistent: hooks and helper scripts use `grep`; ad-hoc agent searches sometimes use `grep`, sometimes use `rg`, sometimes use the `Grep` tool; CLAUDE.md mentions `grep` in passing as a way to inspect captured logs. This ADR makes the choice once.

## Decision Outcome

**All text and code search in this repo uses ripgrep, never POSIX `grep`.**

Concretely, the order of preference is:

1. **Claude Code's built-in `Grep` tool** — for any search performed by Claude or a sub-agent. It is ripgrep under the hood, with structured input/output and no shell-quoting hazards. This is the default for agent work.
2. **`rg` invoked via Bash** — for shell scripts, hooks, commands, and the rare cases where the `Grep` tool's surface (regex + glob/type + path) is not expressive enough.
3. **POSIX `grep`** — not used. The PreToolUse hook nudges; reviewers should call out any new occurrence in PRs.

There are no carve-outs in this repo's code for `grep`. The four existing hooks/commands that previously used `grep` (`.claude/hooks/check-biome-commands.sh`, `.claude/hooks/commit-format.sh`, `.claude/hooks/prevent-wait-for-timeout.sh`, `.claude/commands/create-issue.sh`) are migrated to `rg` as part of this ADR's implementation.

### `git grep` is not in scope

`git grep` is a different tool. It searches git's index — including arbitrary commits, tags, and refs (`git grep <pattern> <commit-ish>`) — and uses git's own pathspec rules. Ripgrep cannot replace it for queries that genuinely need the index or history. The hook leaves `git grep` alone. For working-tree-only searches, prefer `rg`; reach for `git grep` when you actually need git's view of the world.

### Installation

`ripgrep` joins `trivy` as a documented system prerequisite installed via Homebrew on macOS:

```sh
brew install ripgrep
```

Or, more reliably, run the new bootstrap script:

```sh
./scripts/setup-mac.sh
```

The script is idempotent; it skips anything already installed and surfaces optional tools (`opentofu`, `beads`) behind an `INCLUDE_OPTIONAL=1` flag. CI installs `ripgrep` the same way it installs Trivy — via the runner's package manager step, not as an npm dependency.

We deliberately do **not** ship `ripgrep` as an npm wrapper (`@vscode/ripgrep` etc.). Adding a binary-shipping npm package introduces platform-specific download steps inside `pnpm install`, ties the version to npm's release cadence, and obscures the fact that this is a system tool. The same reasoning applies to `trivy` (see [ADR 0008](0008-trivy-security-scan.md)) and to `lefthook`'s binary (see [ADR 0018](0018-lefthook.md), where the npm package's bundled binaries are accepted because lefthook explicitly publishes them).

### The PreToolUse hook

A new advisory hook, `.claude/hooks/check-grep-commands.sh`, runs on every Bash tool call:

- Detects bare `grep`, `egrep`, or `fgrep` invocations.
- Strips out `git grep` before the check so it is not flagged.
- Prints a stderr nudge with a quick `grep` → `rg` flag mapping.
- Exits 0 — the call is **not** blocked. The hook is a reminder, not a gate.

The advisory level matches `.claude/hooks/echo-detection.sh`: tool-preference nudges should not block legitimate edge cases (`man grep`, `which grep`, copying a `grep` snippet into a file). If `grep` keeps recurring in a session, the nudge will keep firing and the agent has the information needed to switch.

Hard enforcement happens at PR-review time, not via the hook. Reviewers reject new `grep` usage in shell scripts the same way they reject new `--no-verify` or `bs update`.

### Quick reference: `grep` → `rg`

| `grep` form                                 | `rg` equivalent                            | Note                                                  |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `grep -E pattern files`                     | `rg pattern files`                         | `rg`'s default regex engine handles ERE-style syntax. |
| `grep -F literal files`                     | `rg -F literal files`                      | Fixed-string match.                                   |
| `grep -i pattern`                           | `rg -i pattern`                            | Case-insensitive.                                     |
| `grep -q pattern`                           | `rg -q pattern`                            | Same exit-code semantics (0 match, 1 no match).       |
| `grep -v pattern`                           | `rg -v pattern`                            | Invert match.                                         |
| `grep -r pattern dir`                       | `rg pattern dir`                           | `rg` is recursive by default.                         |
| `grep -l pattern dir`                       | `rg -l pattern dir`                        | Files-with-matches.                                   |
| `grep -A 3 pattern`                         | `rg -A 3 pattern`                          | Context after.                                        |
| `printf '%s' "$x" \| grep -Eq 'pat'`        | `printf '%s' "$x" \| rg -q 'pat'`          | Stream check; same exit codes.                        |
| `grep '\.md$'`                              | `rg '\.md$'`                               | Regex syntax is compatible for the common cases.      |

POSIX bracket classes (`[[:space:]]`, `[[:alnum:]]`) work in `rg`, but `\s`, `\w`, `\d` are more idiomatic. PCRE-only constructs (lookaround, back-references) require `rg --pcre2` (`-P`).

### Reconciliation with CLAUDE.md "Capture output for review"

CLAUDE.md says:

> Prefer `cmd > /tmp/<name>.log 2>&1` over `cmd | grep …` or `cmd | jq …` inline. The user can re-read the file later. Inline pipes discard the raw output. If the file is small, `cat` it after. If large, `tail` or `grep` it — but the full output stays on disk.

That guidance is updated in CLAUDE.md alongside this ADR: capture to file first, then `tail` or `rg` the file. The principle (preserve the raw output) is unchanged; only the search tool changes.

### Implementation plan

1. Add `docs/adr/0009-ripgrep-over-grep.md` (this file) and link it from `docs/adr/README.md`.
2. Add `ripgrep` to the system prerequisites table in [docs/QUICKSTART.md](../QUICKSTART.md).
3. Create `scripts/setup-mac.sh` to install `ripgrep`, `jq`, and `trivy` via Homebrew (with `opentofu`/`beads` behind `INCLUDE_OPTIONAL=1`).
4. Add the operating rule to `CLAUDE.md`; update the existing "Capture output for review" line to say `rg` instead of `grep`.
5. Add `.claude/hooks/check-grep-commands.sh` and wire it into `.claude/settings.json` under the `PreToolUse` Bash matcher.
6. Add `Bash(rg:*)` to the `.claude/settings.json` allow list so `rg` invocations don't prompt.
7. Migrate the four existing in-repo `grep` callsites to `rg`:
   - `.claude/hooks/check-biome-commands.sh`
   - `.claude/hooks/commit-format.sh`
   - `.claude/hooks/prevent-wait-for-timeout.sh`
   - `.claude/commands/create-issue.sh`
8. Verify: `pnpm check` still green; the hook fires a nudge on a synthetic `grep` Bash call and stays silent on `git grep` and `rg`.

## Consequences

### Positive

- **Faster searches in a monorepo** — `.gitignore` awareness alone removes most of the noise that made `grep -r` painful here.
- **One regex flavour** — Claude's `Grep` tool, `rg` in Bash, and editor search (VS Code's built-in search uses `@vscode/ripgrep`) all use the same engine. No more "works in grep, not in rg" gotchas.
- **Structured agent searches by default** — pushing toward the built-in `Grep` tool keeps search results structured and free of shell-quoting bugs.
- **Cleaner shell scripts** — `rg -q` reads the same as `grep -q` but without the BRE/ERE flag dance (`-E`).
- **Consistent with editor and CI** — VS Code, GitHub code search, and ripgrep all agree on `.gitignore`-aware behaviour.

### Negative

- **New system dependency** — devs and CI need `rg` on PATH. Mitigated by `scripts/setup-mac.sh` and the QUICKSTART prerequisites table, but it is one more thing that can be missing on a fresh machine. The hooks themselves now depend on `rg`; if it is missing, hook checks no-op (`if rg -q ...` short-circuits cleanly), but that means the gate is silently weaker until `rg` is installed.
- **Slightly different regex flavour** — `rg` uses Rust's `regex` crate (RE2-style), not POSIX BRE/ERE. The common cases overlap; the edges (lookaround, back-references) require `-P` for PCRE2. Devs who reach for those features need to add the flag.
- **`grep` muscle memory** — long-time shell users will type `grep` reflexively. The advisory hook addresses this without blocking.

### Neutral

- **The hook is advisory, not blocking.** Edge cases (`man grep`, `git grep`, demo strings) keep working without special-casing. PR review enforces the rule for committed code.
- **`git grep` is unaffected.** It remains the right tool for index-scoped or history-scoped queries.
- **CI cost change is negligible** — installing `ripgrep` via the runner's package manager is sub-second and amortised across every job.

## Alternatives considered

### 1. Stay on POSIX `grep`

- **Pro**: Zero install. Universal.
- **Con**: Slower, no `.gitignore` awareness, noisy in a monorepo, splits the team's mental model from VS Code search and Claude's `Grep` tool. Rejected.

### 2. ag (the_silver_searcher)

- **Pro**: Also gitignore-aware; long-established.
- **Con**: Development has slowed; `rg` outperforms it on most benchmarks; smaller feature set (no PCRE2, weaker glob/type filters). Rejected.

### 3. ack

- **Pro**: Pure Perl, zero binary deps if Perl is present.
- **Con**: Significantly slower than both `ag` and `rg`; weaker default filtering. Rejected.

### 4. A linter rule (shellcheck plugin) instead of a hook

- **Pro**: Catches `grep` in committed shell scripts deterministically.
- **Con**: Does not catch ad-hoc `grep` invocations made by Claude through the Bash tool — the dominant use case this ADR targets. Worth adding later as a complement, not a replacement.

### 5. Ship `ripgrep` as an npm wrapper

- **Pro**: `pnpm install` would put `rg` on PATH automatically.
- **Con**: Couples the tool's version to npm release cadence; introduces a binary-download step inside `pnpm install`; obscures that `rg` is a system tool used outside Node contexts (shell scripts, CI shell steps). Same reasoning we applied to Trivy in [ADR 0008](0008-trivy-security-scan.md).

## References

- [ripgrep — GitHub](https://github.com/BurntSushi/ripgrep)
- [ripgrep user guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)
- [Andrew Gallant — "ripgrep is faster than {grep, ag, git grep, ucg, pt, sift}"](https://blog.burntsushi.net/ripgrep/)
- [ADR 0018: Lefthook for git hooks](0018-lefthook.md) — precedent for accepting a binary system dep.
- [ADR 0029: Claude Code configuration layout](0029-claude-code-setup.md) — where the new hook lives.
- [ADR 0008: Trivy for vulnerability scanning](0008-trivy-security-scan.md) — precedent for installing a Rust/Go system tool via Homebrew rather than npm.
