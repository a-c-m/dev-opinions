# SOPs

Standard Operating Procedures — developer doing normal work. Cross-cutting SOPs live in this folder; service-specific SOPs (rare) live alongside code at `apps/<product>/<service>/sops/`. Start from [`TEMPLATE.md`](TEMPLATE.md).

## Format

- Kebab-case filenames, descriptive. **No `SOP-NNN` prefix** — the path is the identity.
- Optional frontmatter: `status: deprecated` (omit when active).
- Required sections: Overview, Prerequisites, Steps, Related.

## Agent prompt

When relevant to the task, consult the matching file under `sops/`. Before relying on a procedure, run `git log -1 --follow --format=%cI <file>` and surface to the user if the file is **>90 days old** — a stale SOP may not match current behaviour.
