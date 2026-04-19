# Security policy

## Reporting a vulnerability

Please report security issues **privately** — not via a public GitHub issue.

Two channels, in order of preference:

1. **GitHub Security Advisories** — open a draft advisory at the repo's
   Security tab → "Report a vulnerability".
2. **Email** — `security@example.com` (replace with the project's real
   contact on adoption).

Please include:

- A clear description of the vulnerability and its impact.
- Steps to reproduce.
- Affected versions or commits.
- Any proof-of-concept code or data.

We will acknowledge receipt within **48 hours**.

## Service-level agreement

| Severity | Description | Fix timeline |
|---|---|---|
| **Critical** | Remote code execution, authentication bypass, data loss | 30 days |
| **High** | SQL injection, cross-site scripting with user impact, privilege escalation | 60 days |
| **Medium** | CSRF, sensitive information disclosure, limited-impact XSS | 90 days |
| **Low** | Configuration issues, hardening gaps, non-sensitive disclosure | 90 days |

These are target timelines from confirmation of the vulnerability. Critical
issues may be shipped faster if a patch is ready.

## Scope

- Current `main` branch and the most recent release.
- Supply-chain vulnerabilities in dependencies are in scope if this project
  pins a vulnerable version; report upstream as well when applicable.

## Out of scope

- Social engineering.
- Attacks requiring physical access to a user's machine.
- Issues in third-party services we integrate with but do not control.

## Coordinated disclosure

If you follow responsible disclosure we will credit you in the advisory and
the release notes. Please give us the full SLA window before public
disclosure unless there is active exploitation.
