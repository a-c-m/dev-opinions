# Configuring GitHub protections

## Overview

Realises the **Protection requirements** of
[ADR 0035](../adr/0035-branching-releases-environments.md). The
release flow's integrity guarantees only hold if the protections
below are configured. This is the per-fork *how* for the *what*
the ADR mandates.

Work through the steps in order. Each carries a **Where** (UI
path), **What** (settings to apply), and **Verify** (a sanity
check). Workflow filenames (`cut-release.yml`, `tag-release.yml`,
`deploy-prod.yml`) are the ADR's examples — substitute your
fork's actual names.

One-time setup, but re-run the **Verify** blocks any time CI
checks are renamed, the bot actor changes, or a new protected
branch is added.

Placeholders used throughout — replace every one:

| Token | Meaning |
| --- | --- |
| `<ORG>/<REPO>` | GitHub org and repository slug |
| `<BOT>` | bot/automation account handle |
| `<BOT_TOKEN>` | repo secret holding the bot's token |
| `<TEAM>` | a CODEOWNERS team under `<ORG>` |
| `<service>` | a deployable path under `apps/` or `repos/` |
| `<build-check>` / `<check>` | required status-check names |
| `<PROD_SECRET>` | a production-only secret name |

## Prerequisites

- [ ] **Admin access** on `<ORG>/<REPO>`.
- [ ] You know the handle of the **bot account** behind
      `<BOT_TOKEN>` (`<BOT>`). If `<BOT_TOKEN>` is currently a
      personal token, replace it with a dedicated bot user or a
      GitHub App **before** continuing — the bypass entitlement
      granted below is privileged.
- [ ] All workflows have **run at least once** on a recent
      branch, so their check names appear in the "Required
      status checks" picker. Names that don't exist yet can't be
      selected.
- [ ] CODEOWNERS is in place (Step 1). Don't tick "require
      review from Code Owners" until it is.

## Steps

### 1. CODEOWNERS file (code change)

This is a file in the repo, not a settings toggle.

**Where:** create `.github/CODEOWNERS` on a feature branch and
PR it in *before* enabling "require review from Code Owners" in
branch protection. Shape and team-metadata format per
[ADR 0031 → CODEOWNERS](../adr/0031-github-repo-conventions.md#codeowners-githubcodeowners).

**What:** map each owned path to a team. Pure skeleton —
replace every placeholder:

```
.github/workflows/**   @<ORG>/<TEAM>
docs/adr/**            @<ORG>/<TEAM>
docs/runbooks/**       @<ORG>/<TEAM>
apps/<service>/**      @<ORG>/<TEAM>
```

**Verify:**

- [ ] CODEOWNERS is on `main`.
- [ ] A draft PR touching one listed path auto-requests the
      matching team as reviewer.

### 2. Branch protection — `main`

**Where:** `Settings → Branches → Add branch protection rule`.

**Branch name pattern:** `main`

**What:** tick the following.

- [ ] **Require a pull request before merging**
  - [ ] Require approvals → **1**
  - [ ] Dismiss stale approvals when new commits are pushed
  - [ ] Require review from Code Owners
  - [ ] Allow specified actors to bypass required PRs → `<BOT>`
- [ ] **Require status checks to pass before merging**
  - [ ] Require branches to be up to date before merging
  - [ ] Add the required checks (confirm against your CI —
        [ADR 0032](../adr/0032-github-actions-ci.md)):
    - `<build-check>`
    - `<check>` for each lint/test job that should gate merges
- [ ] **Require conversation resolution before merging**
- [ ] **Restrict who can push** → `<BOT>` (and admins for
      break-glass)
- [ ] **Block force pushes**
- [ ] **Block deletions**

Leave **Do not allow bypassing the above settings** unticked, or
tick it but add `<BOT>` to the bypass list — without the bypass,
`deploy-prod.yml`'s merge-back fails.

**Verify:**

- [ ] As a non-bot user, `git push origin main` is rejected with
      "protected branch hook declined".
- [ ] A small docs PR can't merge without 1 approval and passing
      checks.

### 3. Branch protection — `release-candidate`

`release-candidate` is the release-candidate branch (it
auto-deploys to the stage env — [ADR 0035](../adr/0035-branching-releases-environments.md)).

**Where:** same place; add a rule with pattern
`release-candidate`.

**What:** apply the **same settings as `main`**, including the
`<BOT>` bypass. The release flow needs `<BOT>` to push to
`release-candidate` during `cut-release.yml`. Hotfix PRs into
`release-candidate` still get the ≥1-approval requirement.

**Verify:**

- [ ] As a non-bot user, `git push origin release-candidate` is
      rejected.
- [ ] Trigger `cut-release.yml` from the Actions UI — it runs
      cleanly when `release-candidate` HEAD == last `v*` tag, and
      refuses otherwise ("release in flight").

### 4. Tag protection — `v*`

**Where:** `Settings → Tags → New rule` (classic).

> **Optional:** GitHub's newer **Repository rulesets**
> (`Settings → Rules → Rulesets`) can replace classic tag/branch
> protection in one place. Pick one model and stick to it; for a
> first pass, classic is simpler.

**What:**

- [ ] Tag name pattern: `v*`
- [ ] Allowed to create/delete: only `<BOT>` and repo admins.

**Why:** whoever can push a `v*` tag can trigger a production
deploy via `deploy-prod.yml`. Tag protection is what keeps prod
deploys gated.

**Verify:**

- [ ] As a non-bot user,
      `git tag v0.0.0-test && git push origin v0.0.0-test` is
      rejected.

### 5. Production environment

Two parts: GitHub UI configuration and a code change in
`deploy-prod.yml`.

**Where (UI):** `Settings → Environments → New environment` →
name: `production`.

**What:**

- [ ] **Required reviewers** → 1–2 people who must approve
      before prod-touching jobs start.
- [ ] **Deployment branches and tags** → restrict to tags
      matching `v*`. Stops the workflow running against a
      non-tag ref.
- [ ] (Optional) **Wait timer** for a cooldown before deploys
      begin.
- [ ] **Environment secrets** → move production secrets here so
      non-prod jobs can't read them:
  - `<PROD_SECRET>` (repeat per prod-only secret)

**Code change:** each prod-touching job needs an
`environment: production` key for the protection to bind. Add it
to the build job and every regional/rollout deploy job:

```yaml
build:
  name: Build production image
  needs: validate
  environment: production   # binds to the GitHub Environment
  runs-on: ubuntu-latest
```

**Verify:**

- [ ] Run `deploy-prod.yml` from the Actions UI with a
      known-good tag. It pauses on "Waiting for review"; after
      approval it proceeds to build + deploys.

### 6. Repository-level toggles

**Where:** `Settings → General → Pull Requests`.

- [ ] **Allow merge commits** ✓
- [ ] **Allow squash merging** — author's choice (optional)
- [ ] **Allow rebase merging** — author's choice (optional)
- [ ] **Automatically delete head branches** ✓

> Do **not** enable "Allow only squash merging." It breaks the
> `--no-ff` merge-back at the end of `deploy-prod.yml`, which
> records each release as a real merge commit on `main`
> ([ADR 0035 → Deliberately not adopted](../adr/0035-branching-releases-environments.md)).

**Where:** `Settings → Code security and analysis`.

- [ ] **Secret scanning** → Enable
- [ ] **Push protection** → Enable
- [ ] **Dependabot alerts** → Enable
- [ ] **Dependabot security updates** → Enable

### 7. Bot account hardening (recommended)

If `<BOT>` is a dedicated user (not a GitHub App):

- [ ] 2FA enabled on the bot account.
- [ ] `<BOT_TOKEN>` is a fine-grained PAT scoped to
      `<ORG>/<REPO>` only, with **Contents: read+write**,
      **Pull requests: read+write**, **Metadata: read**.
- [ ] PAT expiry tracked — calendar reminder to rotate before it
      lapses.
- [ ] Plan migration to a GitHub App
      ([ADR 0035 → Deliberately not adopted](../adr/0035-branching-releases-environments.md)).

### 8. End-to-end verification

Once everything above is configured, exercise the full release
flow with a no-op change.

- [ ] Feature branch → trivial change → PR into `main`.
- [ ] Confirm: can't merge without 1 approval + passing checks.
- [ ] Approve and merge — clean merge into `main` (no
      force-push, no bypassed approval).
- [ ] Run `cut-release.yml` — merges `main` →
      `release-candidate` (or refuses: "release already in
      flight").
- [ ] Run `tag-release.yml` on `release-candidate` — bumps
      `<service>` version, pushes the bump commit, creates a
      `v*` tag.
- [ ] Run `deploy-prod.yml` with the new tag.
- [ ] Confirm: it pauses for the `production` environment
      approval.
- [ ] Approve. Confirm deploys run, then the merge-back job
      pushes the tag commit to `main`.
- [ ] Confirm: as a non-bot user, you can't push to `main`,
      push to `release-candidate`, or create/delete a `v*` tag.

## Appendix: scripted alternatives (`gh api`)

For repeatability across forks, most of the above is expressible
as `gh api` calls — useful for documenting "what a fully
protected repo looks like" more than for first-time setup.
Branch protection on `main`:

```bash
gh api -X PUT repos/<ORG>/<REPO>/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=<build-check>' \
  -F 'required_status_checks.contexts[]=<check>' \
  -F enforce_admins=false \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_pull_request_reviews.require_code_owner_reviews=true \
  -F 'restrictions.users[]=<BOT>' \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

The classic API is finicky — it needs
`Accept: application/vnd.github+json` and careful field ordering
for nested objects. UI is faster for a first pass.

## Related

- [ADR 0035](../adr/0035-branching-releases-environments.md) —
  branching/releases/environments; this runbook realises its
  **Protection requirements**.
- [ADR 0031](../adr/0031-github-repo-conventions.md) — CODEOWNERS
  shape and team-metadata format.
- [ADR 0032](../adr/0032-github-actions-ci.md) — the CI workflows
  whose check names gate merges.
