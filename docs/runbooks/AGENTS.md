# Runbooks

Operational procedures — on-call under pressure. Cross-cutting runbooks live in this folder; service-specific runbooks live alongside their code at `apps/<product>/<service>/runbooks/`. Start from [`TEMPLATE.md`](TEMPLATE.md).

## Format

- Kebab-case filenames, descriptive. **No `RUN-NNN` prefix** — the path is the identity.
- Optional frontmatter: `triggers:` (alert names) and `status: deprecated` (omit when active).
- Required sections: Overview, Prerequisites, Steps, Related.
- Optional sections (keep when relevant, delete otherwise): Symptoms (when alert-bound), Rollback (when steps change state), Escalation (when on-call paths apply).

## Agent prompt

When relevant to the task, consult the matching file under `runbooks/`. Before relying on a procedure, run `git log -1 --follow --format=%cI <file>` and surface to the user if the file is **>90 days old** — a stale runbook may not match current behaviour.
