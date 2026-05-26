# Quickstart

This template assumes a few system tools beyond Node and pnpm. The first run
takes ~5 minutes if everything's missing, ~30 seconds if everything's present.

## 1. System prerequisites

| Tool | Why | Install |
|---|---|---|
| **Node 22** | Runtime; pinned exact in `.nvmrc` | `fnm install 22.19.0` or `nvm install` (in repo dir) |
| **pnpm 9+** | Package manager (ADR 0001) | `corepack enable` then `corepack prepare pnpm@9.15.0 --activate` |
| **ripgrep (`rg`)** | All search — Claude hooks, scripts, agent searches (enforced by `.claude/hooks/block-bash-rules.sh`) | macOS: `brew install ripgrep` &nbsp;·&nbsp; Linux: `apt install ripgrep` |
| **jq** | JSON parser used by `.claude/hooks/*` to read tool input | macOS: `brew install jq` &nbsp;·&nbsp; Linux: `apt install jq` |
| **Trivy** | Security gate (ADR 0008) — `pnpm check` fails without it | macOS: `brew install aquasecurity/trivy/trivy` &nbsp;·&nbsp; Linux: see <https://aquasecurity.github.io/trivy/> |
| **OpenTofu** | Required only if you'll touch `apps/*/iac/` | macOS: `brew install opentofu` |
| **beads (`bd`)** | Optional — local task tracking; `.claude/` SessionStart hook surfaces tasks if installed | macOS: `brew install beads` |
| **Lefthook** | Installed automatically as a dev dep on `pnpm install` | nothing to do |
| **Docker** (optional) | Building/running the sample app images | Docker Desktop / OrbStack / colima |

On macOS, the required tools (`ripgrep`, `jq`, `trivy`) can be installed in
one shot with the bootstrap script:

```sh
./scripts/setup-mac.sh                    # required tools only
INCLUDE_OPTIONAL=1 ./scripts/setup-mac.sh # also install opentofu, beads
```

You don't need every tool to start. The minimum to get the gate green is
**Node 22 + pnpm + ripgrep + jq + Trivy**. Beads and OpenTofu are opt-in.

## 2. First clone

```sh
git clone <this-repo> dev-opinions
cd dev-opinions
nvm use            # picks up .nvmrc → 22.19.0
pnpm install       # also installs lefthook git hooks via the `prepare` script
```

## 3. Run the quality gate

```sh
pnpm check
```

That sequences:

| Step | Command | Source of truth |
|---|---|---|
| Lint | `pnpm lint:check` (`bs check`) | ADR 0006 — biome 2 + ultracite + baseline |
| Typecheck | `pnpm typecheck` (`tsgo`) | ADR 0003 |
| Tests | `pnpm test` (vitest 4) | ADR 0012 |
| Dead code | `pnpm knip` | ADR 0007 |
| Security | `pnpm security` (Trivy fs scan) | ADR 0008 |

All five exit 0 on a fresh clone. If `security` fails because Trivy isn't on
PATH, install it (above) — don't skip the step.

## 4. Run the sample apps

```sh
pnpm dev                                  # runs every app in parallel via nx
# or one at a time:
pnpm --filter sample-api dev              # nest start --watch on http://localhost:3000
pnpm --filter sample-web dev              # vite on http://localhost:5173
```

E2E:

```sh
pnpm --filter sample-web e2e              # playwright against the running web app
```

## 5. Build the sample app containers (optional)

```sh
docker build -f apps/sample-api/Dockerfile -t sample-api:dev .
docker build -f apps/sample-web/Dockerfile -t sample-web:dev .
```

`sample-web`'s Dockerfile demonstrates ADR 0017: build with `BUILD_MODE=true`
so VITE_* env values are baked as `___KEY___` placeholder tokens; the
container entrypoint sed-replaces them at runtime. Run it with:

```sh
docker run --rm -p 8080:8080 -e VITE_API_URL=https://prod.api.example.com sample-web:dev
```

## 6. Adopting this template for a new project

When you're ready to start a real project from this scaffold:

```sh
./scripts/reset-template.sh --yes        # removes apps/sample-* and prunes deps
pnpm install                              # refresh the lockfile
pnpm exec nx g @nx/nest:app <name>        # scaffold your first API
# or
pnpm exec nx g @nx/react:app <name>       # scaffold your first frontend
```

Then update:

- Root `README.md` and `AGENTS.md` with project-specific context.
- `package.json` `name` and `description`.
- `.github/CODEOWNERS` (currently `@a-c-m`).
- `.github/SECURITY.md` contact (currently `security@acmconsulting.eu`).
- `.github/ISSUE_TEMPLATE/config.yml` advisory link (currently
  `a-c-m/dev-opinions`).

## 7. Day-to-day commands

```sh
pnpm dev                  # all apps in dev mode
pnpm test                 # all unit tests
pnpm test:e2e             # all E2E tests
pnpm lint                 # biome with --write (auto-fix)
pnpm lint:check           # biome read-only
pnpm typecheck            # tsgo across projects
pnpm knip                 # dead-code / unused-deps scan
pnpm security             # Trivy
pnpm check                # full gate (all of the above)
pnpm check:affected       # nx affected for lint/typecheck/test
pnpm commit               # interactive Conventional Commit (cz)
pnpm reset                # delete sample apps when starting a new project
```

## 8. Troubleshooting

**"`bs: command not found` on first run"** — run `pnpm install` first.
biome-suppressed (`bs`) ships as a workspace devDependency.

**"Trivy reports HIGH/CRITICAL on a fresh clone"** — open it: a transitive
dependency may have an unpatched CVE. Bump the offending package, or add
the CVE to `.trivyignore` with a reason and review date. Don't disable the
step.

**"`pnpm check:affected` finds nothing"** — `nx affected` compares against
`origin/main` by default. On a fresh clone with no remote tracking branch,
either push first or use `--base=HEAD~1`.

**"Lefthook hangs the first commit"** — pre-commit's `nx affected` against
`HEAD~1` no-ops on the very first commit (the hook detects this and skips).
If your fork ends up in a weird state, `LEFTHOOK=0 git commit` is the
escape hatch — use it once, not as a habit.

**"My beads tasks don't show up at session start"** — beads is optional; if
`.beads/` doesn't exist in the repo, the SessionStart hook silently skips.
Run `bd q "<task>"` once to create the local DB.
