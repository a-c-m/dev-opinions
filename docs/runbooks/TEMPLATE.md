---
# triggers:                  # alert names that point here; omit if not alert-bound
#   - <AlertName>
# status: deprecated         # omit when active
---

# <Title>

> Copy this file (don't edit it in place) when authoring a new runbook.
> Shape per [ADR 0026](../adr/0026-runbook-and-sop-format.md).
> Filename: kebab-case, descriptive, no `RUN-NNN` prefix — the path is the identity.

## Overview

What this is for and what success looks like. One paragraph. If the on-call is reading this at 03:00, this paragraph tells them whether they're in the right file.

## Prerequisites

Access, tools, permissions needed before step 1. Write "None" rather than omit.

- ...

## Symptoms

<!-- OPTIONAL — keep when this runbook is bound to an alert or a class of symptoms. Delete the section otherwise. -->

Signals beyond `triggers:` — dashboard panels, error-log shapes, user reports.

- ...

## Steps

Numbered, exact, copy-pasteable.

1. ...

   ```bash
   # exact command in a fenced block
   ```

2. ...

## Rollback

<!-- OPTIONAL — keep when steps change state and undoing them matters. Delete otherwise. -->

How to undo, in the same numbered/fenced form.

## Escalation

<!-- OPTIONAL — keep when on-call escalation paths are relevant. Delete otherwise. -->

See `.github/CODEOWNERS` for current TechLead, Slack channel, and alerting URL via the team-metadata block ([ADR 0020 → CODEOWNERS](../adr/0020-github-repo-conventions.md#codeowners-githubcodeowners)).

## Related

- [ADR NNNN](../adr/NNNN-...) — decision this runbook realises.
- Dashboards, post-mortems, sibling procedures.
