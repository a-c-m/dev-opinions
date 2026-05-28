# GitHub Actions conventions

Practitioner-level rules for writing workflows in `.github/workflows/`. Design
decisions (reusable workflows, OIDC, registry parameterisation, etc.) live in
[ADR 0032](../adr/0032-github-actions-ci.md) — this file documents sharp edges
in the platform itself that aren't obvious from the YAML.

## Rule 1 — `secrets.*` is forbidden inside step `if:` conditions

GitHub's runtime workflow parser silently rejects `${{ secrets.NAME }}` inside
a step's `if:` expression. The YAML still parses under every static linter
(zizmor, js-yaml, actionlint), so this is invisible until the workflow tries
to register.

When it fails, the registration **silently downgrades**:

- The workflow's `name:` field is ignored — the API stores the file path
  (`.github/workflows/_foo.yml`) as the name instead.
- A phantom `push` trigger gets attached, even when `on:` only declares
  `workflow_call`.
- Every commit to the repo fires a 0-second "workflow file issue" failure run
  against this phantom trigger, polluting the Actions tab indefinitely.

Disabling and re-enabling the workflow via the API does not refresh it.
Renaming the file creates a fresh workflow ID, but the new file breaks the
same way as long as the `if:` keeps the `secrets` reference. The only fix is
to remove the `secrets.*` reference from the `if:`.

```yaml
# 🚫 Don't — corrupts the workflow registration
- name: Configure AWS credentials via OIDC
  if: ${{ secrets.aws-role != '' }}
  uses: aws-actions/configure-aws-credentials@<sha>
  with:
    role-to-assume: ${{ secrets.aws-role }}
    aws-region: ${{ vars.AWS_REGION }}
```

```yaml
# ✅ Do — hoist the secret to a job-level env var, gate on env.NAME
jobs:
  plan-apply:
    env:
      AWS_ROLE: ${{ secrets.aws-role }}
    steps:
      - name: Configure AWS credentials via OIDC
        if: env.AWS_ROLE != ''
        uses: aws-actions/configure-aws-credentials@<sha>
        with:
          role-to-assume: ${{ env.AWS_ROLE }}
          aws-region: ${{ vars.AWS_REGION }}
```

The `secrets` context **is** allowed in `with:`, `env:`, and `jobs.<job>.if:`.
Step-level `if:` is the only place this rule applies.

Discovered when `_tofu-deploy.yml` (previously `_infra-deploy.yml`) was stuck
in this state across multiple commits in May 2026; root-cause fix in commit
`591fdbf`.

## Adding a rule

When you discover a new GitHub Actions sharp edge:

1. Confirm static linters (zizmor, actionlint) don't catch it — if they do,
   the linter run is the right home.
2. Reproduce the failure mode in a separate commit so future contributors can
   see what "broken" looks like.
3. Add a new `## Rule N — ...` section here with the symptom, the root cause,
   and the do/don't pair. Match the structure above.
